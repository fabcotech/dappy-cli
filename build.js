const fs = require("fs");
const privateToPublic = require("ethereumjs-util").privateToPublic;

const addTrailing0x = require("./crypto").addTrailing0x;
const stringToKeccak256 = require("./crypto").stringToKeccak256;
const sign = require("./crypto").sign;
const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;

const configFile = fs.readFileSync("dappy.config.json", "utf8");

logDappy();

let js;
let css;
let html;
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

const privateKey = addTrailing0x(config.options.private_key);
const publicKey = privateToPublic(privateKey).toString("hex");
log("publicKey : " + publicKey);

fs.watchFile(config.manifest.jsPath, () => {
  createManifest();
});

fs.watchFile(config.manifest.cssPath, () => {
  createManifest();
});

log("Compiling !");

const createManifest = () => {
  js = fs.readFileSync(config.manifest.jsPath, "utf8");
  css = fs.readFileSync(config.manifest.cssPath, "utf8");
  html = fs.readFileSync(config.manifest.htmlPath, "utf8");

  jsonStringified = JSON.stringify({
    title: config.manifest.title,
    subtitle: config.manifest.subtitle,
    author: config.manifest.author,
    description: config.manifest.description,
    cssLibraries: config.manifest.cssLibraries,
    jsLibraries: config.manifest.jsLibraries,
    js: js,
    css: css,
    html: html,
    version: "0.1"
  });
  base64 = Buffer.from(jsonStringified).toString("base64");
  const manifestHash = stringToKeccak256(base64);
  const signature = sign(privateKey, manifestHash);
  base64 += `____${signature}`;
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
