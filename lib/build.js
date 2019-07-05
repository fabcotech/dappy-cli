const fs = require("fs");

const {
  checkConfigFile,
  createDpy,
  sanitizeFileName,
  createBase64WithSignature,
  createManifestFromFs,
  privateKeyPrompt,
  logDappy
} = require("./utils");

module.exports.build = async () => {
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
    throw new Error(err);
  }

  checkConfigFile(config);

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

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

    const fileName = sanitizeFileName(config.manifest.title);
    const dpy = createDpy(fileName, base64);

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
    log(`${fileName}.dpy created !`);

    process.exit();
  };

  createManifest();
};
