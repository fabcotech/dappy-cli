const fs = require("fs");
const grpc = require("grpc");
const { RNode } = require("rchain-api");
const privateToPublic = require("ethereumjs-util").privateToPublic;

const stringToKeccak256 = require("./crypto").stringToKeccak256;
const sign = require("./crypto").sign;
const addTrailing0x = require("./crypto").addTrailing0x;
const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;

const WATCH = !!process.argv.find(a => a === "--watch");

const configFile = fs.readFileSync("dappy.config.json", "utf8");

let js;
let css;
let html;
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

let rchain;
const clock = () => new Date();

log("host:" + config.options.host);
log("port:" + config.options.port);
rchain = RNode(grpc, {
  host: config.options.host,
  port: config.options.port
});

const privateKey = addTrailing0x(config.options.private_key);
const publicKey = privateToPublic(privateKey).toString("hex");
log("publicKey : " + publicKey);

fs.watchFile(config.manifest.jsPath, () => {
  createManifest();
});

fs.watchFile(config.manifest.cssPath, () => {
  createManifest();
});

if (WATCH) {
  log("Watching for file changes !");
} else {
  log("Compiling !");
}

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

  fs.writeFileSync("manifest.base64", base64, err => {
    if (err) {
      console.error(err);
    }
  });

  const codeWithRegistry = `
  new
    uriChannel,
    private,
    receiverChannel,
    lookup(\`rho:registry:lookup\`),
    insertArbitrary(\`rho:registry:insertArbitrary\`),
    stdout(\`rho:io:stdout\`) in {
      insertArbitrary!("${base64}" , *uriChannel) |

      for(uri <- uriChannel) {
        // stdout!("registry address : " ++ *uri) |
        lookup!(*uri, *receiverChannel) |
        for(value <- receiverChannel) {
          // stdout!("will store this value in registry : " ++ *value) |
          private!(*value) |
          @"${publicKey}"!(*private)
        }
      }
  }`;

  const codeWithoutRegistry = `
  new private in {
      private!("${base64}") |
      @"${publicKey}"!(*private)
  }`;

  rchain
    .doDeploy({
      term: codeWithoutRegistry,
      timestamp: clock().valueOf(),
      from: "0x1",
      nonce: 0,
      phloPrice: { value: 1 },
      phloLimit: { value: 100000 }
    })
    .then(deployMessage => {
      log("doDeploy result:", deployMessage);
      return rchain.createBlock();
    })
    .then(blockCreated => {
      log("block created");
      if (!WATCH) {
        process.exit();
      }
    })
    .catch(err => {
      console.error(err);
      process.exit();
    });
};

createManifest();
