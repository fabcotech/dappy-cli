const fs = require("fs");
var crypto = require("crypto");
var ed25519 = require("ed25519");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;

const configFile = fs.readFileSync("dappy.config.json", "utf8");

logDappy();

let base64;
let jsonStringified;

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

  const codeWithoutRegistry = `
new private in {
    private!("${base64}") |
    @"${channel}"!(*private)
}`;

  var hash = crypto
    .createHash("sha256")
    .update(codeWithoutRegistry)
    .digest(); //returns a buffer
  const hashHex = hash.toString("hex");
  log("hash HEX " + hashHex);

  const timestamp = new Date().valueOf();
  log("timestamp " + timestamp);

  const toSign = hashHex + timestamp;
  log("toSign " + toSign);
  const signature = ed25519.Sign(
    Buffer.from(toSign, "hex"),
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

  fs.writeFileSync("manifest.json", jsonStringified, err => {
    exit(i);
    if (err) {
      console.error(err);
    }
  });
  log("manifest.json created !");

  fs.writeFileSync("contract.rho", codeWithoutRegistry, err => {
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
  log("manifest.base64 created !");

  fs.writeFileSync(
    "deployData.json",
    JSON.stringify({
      user: publicKey,
      term: codeWithoutRegistry,
      timestamp,
      sig: signature.toString("hex"),
      sigAlgorithm: "ed25519",
      from: "",
      phloPrice: { value: 1 },
      phloLimit: { value: 1000000 },
      nonce: 0
    }),
    err => {
      if (err) {
        console.error(err);
      }
    }
  );
  log("deployData.json created !");
  process.exit();
};

createManifest();
