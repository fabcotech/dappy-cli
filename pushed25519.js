const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const crypto = require("crypto");
const ed25519 = require("ed25519");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;

const WATCH = !!process.argv.find(a => a === "--watch");

const configFile = fs.readFileSync("dappy.config.json", "utf8");

const doDeploy = (deployData, client) => {
  return new Promise((resolve, reject) => {
    client.DoDeploy(deployData, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const listenForDataAtName = (options, client) => {
  return new Promise((resolve, reject) => {
    client.listenForDataAtName(options, function(err, blocks) {
      if (err) {
        reject(err);
      } else {
        resolve(blocks);
      }
    });
  });
};

const createBlock = (options, client) => {
  return new Promise((resolve, reject) => {
    client.createBlock(options, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

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
  const signatureBase64 = ed25519.Sign(
    Buffer.from(base64, "base64"),
    Buffer.from(privateKey, "hex")
  );
  base64 = `${base64};${signatureBase64.toString("base64")}`;
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
    user: publicKey,
    term: codeWithoutRegistry,
    timestamp,
    sig: signature.toString("hex"),
    sigAlgorithm: "ed25519",
    from: "",
    phloPrice: { value: 1 },
    phloLimit: { value: 1000000 },
    nonce: 0
  };
  const deployDataOk = {
    ...deployData,
    user: Buffer.from(deployData.user, "hex"),
    sig: Buffer.from(deployData.sig, "hex")
  };

  fs.writeFileSync("manifest.json", jsonStringified, err => {
    exit(i);
    if (err) {
      console.error(err);
    }
  });

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

  protoLoader
    .load("./protobuf/CasperMessage.proto", {
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
      doDeploy(deployDataOk, client)
        .then(() => {
          return createBlock({}, client);
        })
        .then(() => {
          return listenForDataAtName(
            { depth: 1000, name: { exprs: [{ g_string: channel }] } },
            client
          );
        })
        .then(blocks => {
          log("First call " + blocks.length);
          if (!blocks.blockResults.length) {
            throw new Error("No blocks found");
          }
          const block = blocks.blockResults[0];
          return listenForDataAtName(
            {
              depth: 1000,
              name: block.postBlockData[block.postBlockData.length - 1]
            },
            client
          );
        })
        .then(blocks => {
          log("Second call " + blocks.length);
          for (let i = 0; i < blocks.blockResults.length; i += 1) {
            const block = blocks.blockResults[i];
            for (let j = 0; j < block.postBlockData.length; j += 1) {
              const data = block.postBlockData[j].exprs[0].g_string;
              if (data) {
                log(
                  `Received value from block n°${
                    block.block.blockNumber
                  }, ${new Date(
                    parseInt(block.block.timestamp, 10)
                  ).toISOString()}`
                );
                if (data === base64) {
                  log("Data on chain verified !");
                } else {
                  throw new Error("Data could not be verified");
                }
                process.exit();
                return;
              }
            }
          }

          log(
            `Did not found any data for channel @"${config.options.channel_id}"`
          );
          throw new Error("Not found");
        })
        .catch(err => {
          log(err);
          process.exit();
        });
    });
};

createManifest();
