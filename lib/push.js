const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const nacl = require("tweetnacl");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const privateKeyPrompt = require("./utils").privateKeyPrompt;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;
const doDeploy = require("./rchain").doDeploy;
const createBlock = require("./rchain").createBlock;
const payment = require("./rchain").payment;
const deployDataToSign = require("./rchain").deployDataToSign;
const getDeployData = require("./rchain").getDeployData;
const getBlake2Hash = require("./rchain").getBlake2Hash;

module.exports.push = async () => {
  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const pushFile = fs.readFileSync(`${__dirname}/push.rho`, "utf8");

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

  log("publicKey : " + publicKey);

  fs.watchFile(config.manifest.jsPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    createManifest();
  });

  log("Compiling !");

  const createManifest = () => {
    jsonStringified = createManifestFromFs(config);
    base64 = createBase64WithSignature(jsonStringified, privateKey);

    const term = pushFile
      .replace("PUBLIC_KEY", publicKey)
      .replace("MANIFEST", base64);

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
      console.error("Signature not valid");
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
          .then(a => {
            log("Block has been pushed on the blockchain !");
            log(
              "You must now read the logs and add keys registry_uri and unforgeable_name_id so the manifest can be updated"
            );
            process.exit();
          });
      });
  };

  createManifest();
};
