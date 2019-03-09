const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const crypto = require("crypto");
const ed25519 = require("ed25519");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;
const doDeploy = require("./rchain").doDeploy;
const createBlock = require("./rchain").createBlock;

const configFile = fs.readFileSync("dappy.config.json", "utf8");

const pushFile = fs.readFileSync("push.rho", "utf8");

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

const privateKey = config.options.private_key;
const publicKey = config.options.public_key;
const channel = config.options.channel;
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

  const code = pushFile
    .replace("PUBLIC_KEY", publicKey)
    .replace("MANIFEST", base64);

  var hash = crypto
    .createHash("sha256")
    .update(code)
    .digest(); //returns a buffer

  const hashHex = hash.toString("hex");
  log("hash HEX " + hashHex);

  const timestamp = new Date().valueOf();
  log("timestamp " + timestamp);

  const toSign = hashHex + timestamp;
  log("toSign " + toSign);
  const signature = ed25519.Sign(
    new Buffer(toSign, "hex"),
    Buffer.from(privateKey, "hex")
  );
  if (
    ed25519.Verify(
      new Buffer(toSign, "hex"),
      signature,
      Buffer.from(publicKey, "hex")
    )
  ) {
    log("Signature verified");
  } else {
    console.error("Signature not valid");
    process.exit();
  }

  const deployData = {
    // user: publicKey,
    term: code,
    timestamp,
    /* sig: signature.toString("hex"),
    sigAlgorithm: "ed25519", */
    from: "0x1",
    nonce: 0,
    phloPrice: 1,
    phloLimit: 1000000
  };
  /* const deployDataOk = {
    ...deployData,
    user: Buffer.from(deployData.user, "hex"),
    sig: Buffer.from(deployData.sig, "hex")
  }; */

  fs.writeFileSync("manifest.json", jsonStringified, err => {
    exit(i);
    if (err) {
      console.error(err);
    }
  });

  fs.writeFileSync("contract.rho", code, err => {
    exit(i);
    if (err) {
      console.error(err);
    }
  });
  log("contract.rho created !");

  fs.writeFileSync("manifest.base64", base64, err => {
    if (err) {
      console.error(err);
    }
  });

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
