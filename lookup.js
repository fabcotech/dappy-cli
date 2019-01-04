const fs = require("fs");
const grpc = require("grpc");
const { RNode, RHOCore } = require("rchain-api");
const privateToPublic = require("ethereumjs-util").privateToPublic;

const recoverPublicKey = require("./crypto").recoverPublicKey;
const stringToKeccak256 = require("./crypto").stringToKeccak256;
const addTrailing0x = require("./crypto").addTrailing0x;
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

let rchain = RNode(grpc, {
  host: config.options.host,
  port: config.options.port
});

const privateKey = addTrailing0x(config.options.private_key);
const publicKeyFromFile = privateToPublic(privateKey).toString("hex");

log("Will look for channel " + `@"${publicKeyFromFile}"`);
rchain
  .listenForDataAtPublicName(publicKeyFromFile)
  .then(blockResults => {
    if (!blockResults.length) {
      console.error("No block results");
      process.exit();
    }
    log(`${blockResults.length} block(s) found`);
    const block = blockResults[0];
    return rchain.listenForDataAtName(block.postBlockData.slice(-1).pop());
  })
  .then(blockResults => {
    for (let i = 0; i < blockResults.length; i += 1) {
      const block = blockResults[i];
      for (let j = 0; j < block.postBlockData.length; j += 1) {
        const data = RHOCore.toRholang(block.postBlockData[j]);
        if (data) {
          log(
            `Received value from block n°${block.block.blockNumber}, ${new Date(
              parseInt(block.block.timestamp, 10)
            ).toISOString()}`
          );
          try {
            const splitted = data.substr(1, data.length - 2).split("____");
            const manifest = splitted[0];
            const signature = splitted[1];
            const manifestHash = stringToKeccak256(manifest);
            const publicKey = recoverPublicKey(signature, manifestHash);
            if (publicKeyFromFile === publicKey) {
              console.log("\n");
              log("____");
              log("\u2713\u2713\u2713 SIGNATURE VERIFIED \u2713\u2713\u2713");
              log(
                `Public key inferred from private key in the config file matches with the signature from the manifest on the blockchain`
              );
              log("Public key : " + publicKey);
              log("____");
            } else {
              console.log("\n");
              logError("____");
              logError(
                "\u274C\u274C\u274C SIGNATURE INVALID \u274C\u274C\u274C"
              );
              logError(
                `  Public key inferred from private key in the config file does not match with the signature from the manifest on the blockchain`
              );
              log(
                "Public key from private key in the config file : ",
                publicKeyFromFile
              );
              log("Public key from the manifest : ", publicKey);
              logError("____");
            }
            log("Manifest (base64): ");
            console.log(splitted[0]);
          } catch (e) {
            logError("Unable to parse manifest and signature");
            console.error(e);
          }
          process.exit();
          return;
        }
      }
    }

    logError(`Did not found any data for channel @"${publicKeyFromFile}"`);
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit();
  });
