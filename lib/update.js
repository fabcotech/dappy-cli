const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const ed25519 = require("ed25519");
const keccak256 = require("keccak256");
const nacl = require("tweetnacl");

const {
  checkConfigFile,
  createDpy,
  sanitizeFileName,
  createBase64WithSignature,
  createManifestFromFs,
  privateKeyPrompt,
  logDappy
} = require("./utils");
const {
  getDeployDataToSign,
  doDeploy,
  getBlake2Hash,
  getDeployData,
  getValueFromBlocks,
  listenForDataAtName,
  parseEitherListeningNameData,
  payment
} = require("./rchain");

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

  const createManifest = async () => {
    jsonStringified = createManifestFromFs(config);
    base64 = createBase64WithSignature(jsonStringified, privateKey);

    const fileName = sanitizeFileName(config.manifest.title);
    const dpy = createDpy(fileName, base64);

    const hashManifest = keccak256(base64).toString("hex");
    const signatureManifest = ed25519.Sign(
      new Buffer(hashManifest, "hex"),
      Buffer.from(privateKey, "hex")
    );

    let term = updateFile
      .replace("REGISTRY_URI", registryUri)
      .replace("MANIFEST", dpy)
      .replace("SIGNATURE", signatureManifest.toString("hex"));

    const timestamp = new Date().valueOf();
    const phloPrice = 1;
    const phloLimit = 1000000;
    const deployData = await getDeployData(
      "ed25519",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit
    );

    const p = payment(timestamp, term, phloPrice, phloLimit);
    const toSign = await getDeployDataToSign(p);
    const signature = deployData.sig;
    const hash = getBlake2Hash(toSign);

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
      if (err) {
        console.error(err);
      }
    });
    log("manifest.json created !");

    fs.writeFileSync(`${fileName}.dpy`, dpy, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync(`${fileName}.dpy`);
    const dpyFileSize = stats.size / 1000;
    log(`${fileName}.dpy created : ` + dpyFileSize + "ko");

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
