const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");

const checkConfigFile = require("./utils").checkConfigFile;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;
const listenForDataAtName = require("./rchain").listenForDataAtName;
const logDappy = require("./utils").logDappy;

const configFile = fs.readFileSync("dappy.config.json", "utf8");

if (!configFile) {
  throw new Error("No config file");
}

logDappy();

const log = a => {
  console.log(new Date().toISOString(), a);
};
const logError = a => {
  console.error(new Date().toISOString(), a);
};

let config;
try {
  config = JSON.parse(configFile);
} catch (err) {
  throw new Error("Unable to parse config file");
}

log("Starting lookup");

checkConfigFile(config);

let client;

log("host : " + config.options.host);
log("port : " + config.options.port);

const privateKey = config.options.private_key;
const publicKey = config.options.public_key;
const channel = config.options.channel;

jsonStringified = createManifestFromFs(config);
base64 = createBase64WithSignature(jsonStringified, privateKey);

log("publicKey : " + publicKey);

log("Will look for channel " + `@"${channel}"`);

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
    client = new packageObject.coop.rchain.casper.protocol.DeployService(
      `${config.options.host}:${config.options.port}`,
      grpc.credentials.createInsecure()
    );

    return listenForDataAtName(
      { depth: 1000, name: { exprs: [{ g_string: channel }] } },
      client
    );
  })
  .then(blocks => {
    for (let i = 0; i < blocks.blockResults.length; i += 1) {
      const block = blocks.blockResults[i];
      for (let j = 0; j < block.postBlockData.length; j += 1) {
        const data = block.postBlockData[j].exprs[0].g_string;
        if (data) {
          log(
            `Received value from block n°${block.block.blockNumber}, ${new Date(
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

    log(`Did not found any data for channel @"${config.options.channel_id}"`);
    throw new Error("Not found");
  });
