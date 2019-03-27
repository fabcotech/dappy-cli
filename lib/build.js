const fs = require("fs");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;

module.exports.build = () => {
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

    fs.writeFileSync("manifest.json", jsonStringified, err => {
      exit(i);
      if (err) {
        console.error(err);
      }
    });
    log("manifest.json created !");

    fs.writeFileSync("manifest.base64", base64, err => {
      if (err) {
        console.error(err);
      }
    });
    log("manifest.base64 created !");

    process.exit();
  };

  createManifest();
};
