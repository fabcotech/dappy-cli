const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const crypto = require("crypto");
const ed25519 = require("ed25519");
const keccak256 = require("keccak256");
const nacl = require("tweetnacl");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const privateKeyPrompt = require("./utils").privateKeyPrompt;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;
const getValueFromBlocks = require("./rchain").getValueFromBlocks;
const doDeploy = require("./rchain").doDeploy;
const listenForDataAtName = require("./rchain").listenForDataAtName;
const createBlock = require("./rchain").createBlock;
const parseEitherListeningNameData = require("./rchain")
  .parseEitherListeningNameData;
const payment = require("./rchain").payment;
const deployDataToSign = require("./rchain").deployDataToSign;
const getDeployData = require("./rchain").getDeployData;
const getBlake2Hash = require("./rchain").getBlake2Hash;

module.exports.update = async () => {
  const WATCH = !!process.argv.find(a => a === "--watch");

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const updateFile = fs.readFileSync(`${__dirname}/update.rho`, "utf8");

  let base64;
  let jsonStringified;

  logDappy();

  if (!configFile) {
    throw new Error("No config file");
  }

  const log = a => {
    console.log(new Date().toISOString(), a);
  };

  let config;
  try {
    config = JSON.parse(configFile);
  } catch (err) {
    throw new Error("Unable to parse config file");
  }

  checkConfigFile(config);

  log("host : " + config.options.host);
  log("port : " + config.options.port);

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

  const publicKey = config.options.public_key;
  const registryUri = config.options.registry_uri;
  let unforgeableNameId = config.options.unforgeable_name_id;
  if (unforgeableNameId && unforgeableNameId.startsWith("0x")) {
    unforgeableNameId = unforgeableNameId.slice(2);
  }

  if (!registryUri) {
    log(
      "Error : In order to update the manifest, you must provide a registry_uri in dappy.config.json"
    );
    process.exit();
  }
  if (!unforgeableNameId) {
    log(
      "Error : In order to update the manifest, you must provide a unforgeable_name_id in dappy.config.json"
    );
    process.exit();
  }

  log("publicKey : " + publicKey);

  fs.watchFile(config.manifest.jsPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.htmlPath, () => {
    createManifest();
  });

  if (WATCH) {
    log("Watching for file changes !");
  } else {
    log("Compiling !");
  }

  const createManifest = () => {
    jsonStringified = createManifestFromFs(config);
    base64 = createBase64WithSignature(jsonStringified, privateKey);

    const hashManifest = keccak256(base64).toString("hex");
    const signatureManifest = ed25519.Sign(
      new Buffer(hashManifest, "hex"),
      Buffer.from(privateKey, "hex")
    );

    let term = updateFile
      .replace("REGISTRY_URI", registryUri)
      .replace("MANIFEST", base64)
      .replace("SIGNATURE", signatureManifest.toString("hex"));

    const timestamp = new Date().valueOf();
    const phloPrice = 1;
    const phloLimit = 1000000;
    const deployData = getDeployData(
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit
    );

    const p = payment(timestamp, term, phloPrice, phloLimit);
    const toSign = deployDataToSign(p);
    const signature = deployData.sig;
    const hash = getBlake2Hash(new Uint8Array(toSign));

    const verify = nacl.sign.detached.verify(
      hash,
      signature,
      Buffer.from(publicKey, "hex")
    );

    if (!verify) {
      log("Error signature not valid");
      process.exit();
    }

    fs.writeFileSync("manifest.json", jsonStringified, err => {
      exit(i);
      if (err) {
        console.error(err);
      }
    });

    fs.writeFileSync("manifest.base64", base64, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync("manifest.base64");
    const manifestBase64Size = stats.size / 1000;
    log("manifest.base64 created : " + manifestBase64Size + "ko");

    protoLoader
      .load(__dirname + "/protobuf/CasperMessage.proto", {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      })
      .then(packageDefinition => {
        const packageObject = grpc.loadPackageDefinition(packageDefinition);
        const client = new packageObject.coop.rchain.casper.protocol.DeployService(
          `${config.options.host}:${config.options.port}`,
          grpc.credentials.createInsecure()
        );

        doDeploy(deployData, client)
          .then(() => {
            return createBlock({}, client);
          })
          .then(() => {
            const nameByteArray = new Buffer(unforgeableNameId, "hex");
            const channelRequest = {
              ids: [{ id: Array.from(nameByteArray) }]
            };

            const parameters = {
              name: channelRequest,
              depth: 1000
            };

            return listenForDataAtName(parameters, client)
              .then(either => {
                let blocks;
                try {
                  blocks = parseEitherListeningNameData(either);
                } catch (err) {
                  log("Error when parsing data at name");
                  log(err);
                }

                let data;
                try {
                  data = getValueFromBlocks(blocks);
                } catch (err) {
                  log("Error when parsing data at name (2)");
                  log(err);
                }

                const manifest = data.exprs[0].g_string;
                log(
                  "Manifest value on chain is : " +
                    manifest.substr(0, 15) +
                    "..." +
                    manifest.substr(manifest.length - 15)
                );
                if (manifest === base64) {
                  log("Data on chain verified !");
                  log(
                    "Pushed successfully on unforgeable name " +
                      unforgeableNameId
                  );
                  if (!WATCH) {
                    process.exit();
                  }
                } else {
                  throw new Error("Data could not be verified");
                }
              })
              .catch(err => {
                log("Error when getting data at name");
                log(err);
              });
          });
      });
  };

  createManifest();
};
