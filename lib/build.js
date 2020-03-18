const fs = require("fs");
const zlib = require("zlib");

const {
  checkConfigFile,
  createFile,
  sanitizeFileName,
  createSignature,
  createBase64,
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

  let privateKey = config.options.privateKey;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

  fs.watchFile(config.manifest.jsPath, () => {
    build();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    build();
  });

  log("Compiling !");

  const build = () => {
    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    if (htmlWithTags.includes("UNFORGEABLE_NAME_1")) {
      log(
        "CAREFUL, the dpy created by build script does not include the strings UNFORGEABLE_NAME, PUBLIC_KEY, REV_ADDRESS and NONCE replaced by the correct values"
      );
    }

    base64 = createBase64(htmlWithTags);
    const signature = createSignature(base64, mimeType, name, privateKey);

    let dpy = createFile(base64, mimeType, name, signature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    fs.writeFileSync(name, dpy, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync(name);
    const dpyFileSize = stats.size / 1000;
    log(`${name} created : ` + dpyFileSize + "ko");
    process.exit();
  };

  build();
};
