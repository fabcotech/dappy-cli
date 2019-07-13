const fs = require("fs");

const {
  checkConfigFile,
  createDpy,
  sanitizeFileName,
  createBase64WithSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy
} = require("./utils");

module.exports.build = async () => {
  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  logDappy();

  let base64;
  let htmlWithTags;

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
    htmlWithTags = createHtmlWithTags(config);
    base64 = createBase64WithSignature(htmlWithTags, privateKey);

    const fileName = sanitizeFileName(config.manifest.title);
    const dpy = createDpy(fileName, base64);

    fs.writeFileSync(`${fileName}.dpy`, dpy, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync(`${fileName}.dpy`);
    const dpyFileSize = stats.size / 1000;
    log(`${fileName}.dpy created : ` + dpyFileSize + "ko");
    process.exit();
  };

  createManifest();
};
