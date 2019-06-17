const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const { load } = require("protobufjs");

const checkConfigFile = require("./utils").checkConfigFile;
const logDappy = require("./utils").logDappy;
const privateKeyPrompt = require("./utils").privateKeyPrompt;
const createManifestFromFs = require("./utils").createManifestFromFs;
const createBase64WithSignature = require("./utils").createBase64WithSignature;
const doDeploy = require("./rchain").doDeploy;
const createBlock = require("./rchain").createBlock;
const getDeployData = require("./rchain").getDeployData;
const parseEitherPrivateNamePreview = require("./rchain")
  .parseEitherPrivateNamePreview;
const parseEitherListeningNameData = require("./rchain")
  .parseEitherListeningNameData;
const unforgeableWithId = require("./rchain").unforgeableWithId;
const previewPrivateNames = require("./rchain").previewPrivateNames;
const listenForDataAtName = require("./rchain").listenForDataAtName;
const getValueFromBlocks = require("./rchain").getValueFromBlocks;
const rholangMapToJsObject = require("./rchain").rholangMapToJsObject;
const { verifyPrivateAndPublicKey } = require("./rchain");

module.exports.push = async () => {
  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const pushFile = fs.readFileSync(`${__dirname}/push.rho`, "utf8");

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

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }
  const publicKey = config.options.public_key;

  log("publicKey : " + publicKey);

  // verifyPrivateAndPublicKey(privateKey, publicKey);

  fs.watchFile(config.manifest.jsPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    createManifest();
  });

  log("Compiling !");

  const createManifest = async () => {
    jsonStringified = createManifestFromFs(config);
    base64 = createBase64WithSignature(jsonStringified, privateKey);

    const term = pushFile
      .replace("PUBLIC_KEY", publicKey)
      .replace("MANIFEST", base64);

    const timestamp = new Date().valueOf();
    const phloPrice = 1;
    const phloLimit = 1000000;
    const deployData = await getDeployData(
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit
    );
    console.log(deployData);

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
    const stats = fs.statSync("manifest.base64");
    const manifestBase64Size = stats.size / 1000;
    log("manifest.base64 created : " + manifestBase64Size + "ko");

    protoLoader
      .load(__dirname + "/protobuf2/DeployService.proto", {
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

        previewPrivateNames(
          {
            user: Buffer.from(publicKey, "hex"),
            timestamp: timestamp,
            nameQty: 1
          },
          client
        )
          .then(async either => {
            let privateNames;
            try {
              privateNames = await parseEitherPrivateNamePreview(either);
            } catch (err) {
              log("Error when parsing previewed name");
              log(err.message);
              process.exit();
            }

            let privateName;
            try {
              privateName = unforgeableWithId(privateNames.ids[0]);
            } catch (err) {
              log("Error when parsing previewed name (2)");
              log(err.message);
              process.exit();
            }

            doDeploy(deployData, client)
              .then(a => {
                console.log(a);
                return;
                log("block has been pushed on the blockchain !");

                log("privateName " + privateName);
                const nameByteArray = new Buffer(privateName, "hex");
                const channelRequest = {
                  ids: [{ id: Array.from(nameByteArray) }]
                };

                const parameters = {
                  name: channelRequest,
                  depth: 1000
                };

                const listenForDataAtNameFunc = () => {
                  return new Promise((resolve, reject) => {
                    listenForDataAtName(parameters, client).then(either => {
                      let blocks;
                      try {
                        blocks = parseEitherListeningNameData(either);
                      } catch (err) {
                        reject(err);
                      }

                      let data;
                      try {
                        data = getValueFromBlocks(blocks);
                      } catch (err) {
                        reject(err);
                      }

                      resolve(data);
                    });
                  });
                };

                listenForDataAtNameFunc()
                  .then(a => {
                    const result = rholangMapToJsObject(a.exprs[0].e_map_body);
                    log(
                      "dapp manifest successfully recorded in the blockchain, please now add the following properties to your dappy.config.json file"
                    );
                    log("");
                    log("registry_uri : " + result.registry_uri.slice(7));
                    log(
                      "unforgeable_name_id : " +
                        unforgeableWithId(result.unforgeable_name)
                    );
                    process.exit();
                  })
                  .catch(err => {
                    log("Error when getting data at name");
                    log(err);
                    process.exit();
                  });
              })
              .catch(err => {
                log("Error when deploying");
                log(err.message);
                process.exit();
              });
          })
          .catch(err => {
            log("Error when retreiving previewed name");
            log(err.message);
            process.exit();
          });
      })
      .catch(err => {
        console.log(err);
        process.exit();
      });
  };

  createManifest();
};
