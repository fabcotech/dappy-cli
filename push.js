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
const listenForDataAtName = require("./rchain").listenForDataAtName;
const createBlock = require("./rchain").createBlock;

const WATCH = !!process.argv.find(a => a === "--watch");

const configFile = fs.readFileSync("dappy.config.json", "utf8");

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

if (WATCH) {
  log("Watching for file changes !");
} else {
  log("Compiling !");
}

const createManifest = () => {
  jsonStringified = createManifestFromFs(config);
  base64 = createBase64WithSignature(jsonStringified, privateKey);

  const codeWithoutRegistry = `@"${channel}"!!("${base64}")`;

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
    // user: publicKey,
    term: codeWithoutRegistry,
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
        .then(() => {
          return listenForDataAtName(
            { depth: 1000, name: { exprs: [{ g_string: channel }] } },
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
                log("value is : " + data.substr(0, 20) + "...");
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
