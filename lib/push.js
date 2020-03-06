const fs = require("fs");
const zlib = require("zlib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");
const uuidv4 = require("uuid/v4");

const {
  checkConfigFile,
  createFile,
  sanitizeFileName,
  createBase64,
  createSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy,
  generateSignatureForNonce,
  buildUnforgeableNameQuery,
  rholangFilesModuleResourceTerm,
  getProcessArgv,
  log,
  rholangFilesModuleTerm,
  rholangFilesModuleAddResourceTerm
} = require("./utils");

module.exports.push = async () => {
  logDappy();

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  let pushFile;
  try {
    pushFile = fs.readFileSync(`push.rho`, "utf8");
    log("Using push.rho file from your directory");
  } catch (err) {
    log("Using default push.rho file from dappy-cli");
  }

  let base64;

  if (!configFile) {
    throw new Error("No config file");
  }

  let config;
  try {
    config = JSON.parse(configFile);
  } catch (err) {
    throw new Error("Unable to parse config file");
  }

  checkConfigFile(config);

  log("host (read-only):                   " + config.options.readOnlyHost);
  log(
    "host (read-only) HTTP port:         " + config.options.readOnlyHostHttpPort
  );
  log("host (validator):                   " + config.options.validatorHost);
  log(
    "host (validator) HTTP port:         " +
      config.options.validatorHostHttpPort
  );
  log(
    "host (validator) GRPC propose port: " +
      config.options.validatorHostgrpcProposePort
  );

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);
  log("publicKey : " + publicKey);

  let phloLimit = getProcessArgv("--phlo-limit");
  if (!phloLimit) {
    log("default phlo limit to " + 100000000);
    phloLimit = 100000000;
  } else {
    phloLimit = parseInt(phloLimit);
  }

  fs.watchFile(config.manifest.jsPath, () => {
    push();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    push();
  });

  log("Compiling !");

  const push = async () => {
    const httpUrlReadOnly = `${config.options.readOnlyHost}:${config.options.readOnlyHostHttpPort}`;
    const httpUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostHttpPort}`;
    const grpcUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostgrpcProposePort}`;
    const timestamp = new Date().valueOf();

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      grpcUrlValidator.replace("http://", "").replace("https://", ""),
      grpc,
      protoLoader
    );

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    let validAfterBlockNumber;
    try {
      validAfterBlockNumber = JSON.parse(
        await rchainToolkit.http.blocks(httpUrlReadOnly, {
          position: 1
        })
      )[0].blockNumber;
    } catch (err) {
      log("Unable to get last finalized block", "error");
      console.log(err);
      process.exit();
    }

    let prepareDeployResponse;
    try {
      prepareDeployResponse = await rchainToolkit.http.prepareDeploy(
        httpUrlReadOnly,
        {
          deployer: publicKey,
          timestamp: timestamp,
          nameQty: 1
        }
      );
    } catch (err) {
      log("Unable to prepare deploy", "error");
      console.log(err);
      process.exit();
    }

    let term1;
    if (pushFile) {
      term1 = pushFile;
    } else {
      term1 = rholangFilesModuleTerm(publicKey, uuidv4().replace(/-/g, ""));
    }

    term1 = term1.replace(new RegExp("PUBLIC_KEY", "g"), publicKey);

    while (term1.indexOf("NONCE") !== -1) {
      const nonce = uuidv4().replace(/-/g, "");
      log('Replaced "NONCE" (found in rholang), with ' + nonce);
      term1 = term1.replace("NONCE", nonce);
    }

    const phloPrice = 1;
    const deployOptions1 = await rchainToolkit.utils.getDeployOptions(
      "secp256k1",
      timestamp,
      term1,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      validAfterBlockNumber || -1
    );

    try {
      const deployResponse = await rchainToolkit.http.deploy(
        httpUrlValidator,
        deployOptions1
      );
      if (!deployResponse.startsWith('"Success')) {
        log("Unable to deploy", "error");
        process.exit();
      }
    } catch (err) {
      log("Unable to deploy", "error");
      console.log(err);
      process.exit();
    }

    try {
      await new Promise((resolve, reject) => {
        let over = false;
        setTimeout(() => {
          if (!over) {
            over = true;
            reject(
              "Timeout error, waited 8 seconds for GRPC response. Skipping."
            );
          }
        }, 8000);
        rchainToolkit.grpc.propose({}, grpcProposeClient).then(a => {
          if (!over) {
            over = true;
            resolve();
          }
        });
      });
    } catch (err) {
      log("Unable to propose, skip propose", "warning");
      console.log(err);
    }

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      JSON.parse(prepareDeployResponse).names[0]
    );

    let dataAtNameResponseExpr1;
    try {
      dataAtNameResponseExpr1 = await new Promise((resolve, reject) => {
        let i = 0;
        interval = setInterval(() => {
          i += 1;
          if (i > 48) {
            reject("12 minutes timeout exceeded");
            return;
          }

          try {
            rchainToolkit.http
              .dataAtName(httpUrlReadOnly, {
                name: unforgeableNameQuery,
                depth: 5
              })
              .then(dataAtNameResponse => {
                const parsedResponse = JSON.parse(dataAtNameResponse);
                if (!parsedResponse.exprs.length) {
                  log(
                    "Cannot retreive transaction data, will retry in 15 seconds"
                  );
                  return;
                }

                const jsValue = rchainToolkit.utils.rhoValToJs(
                  parsedResponse.exprs[0].expr
                );

                resolve(jsValue);
                clearInterval(interval);
              });
          } catch (err) {
            log("First deploy data could not be retreived", "error");
            console.log(err);
            process.exit();
          }
        }, 15000);
      });
    } catch (err) {
      log("First deploy data could not be retreived", "error");
      console.log(err);
      process.exit();
    }

    const fileId = config.manifest.fileId || "index";

    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);

    htmlWithTags = htmlWithTags
      .replace(
        new RegExp("REGISTRY_URI", "g"),
        dataAtNameResponseExpr1.filesRegistryUri.replace("rho:id:", "")
      )
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(
        new RegExp("FULL_ADDRESS", "g"),
        `${dataAtNameResponseExpr1.filesRegistryUri.replace(
          "rho:id:",
          ""
        )}.${fileId}`
      )
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress);

    base64 = createBase64(htmlWithTags);
    const fileSignature = createSignature(base64, mimeType, name, privateKey);
    let dpy = createFile(base64, mimeType, name, fileSignature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    let term2 = rholangFilesModuleAddResourceTerm(
      dataAtNameResponseExpr1.entryRegistryUri,
      fileId,
      dpy,
      generateSignatureForNonce(dataAtNameResponseExpr1.nonce, privateKey),
      uuidv4().replace(/-/g, "")
    );

    const timestamp2 = timestamp + 1;
    const deployOptions2 = await rchainToolkit.utils.getDeployOptions(
      "secp256k1",
      timestamp2,
      term2,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      validAfterBlockNumber || -1
    );

    fs.writeFileSync(name, dpy, err => {
      if (err) {
        log("Error writing file to the file system", "error");
        console.error(err);
        process.exit();
      }
    });
    const stats = fs.statSync(name);
    const dpyFileSize = stats.size / 1000;
    log(`${name} created : ` + dpyFileSize + "ko");

    try {
      const deployResponse2 = await rchainToolkit.http.deploy(
        httpUrlValidator,
        deployOptions2
      );
      if (!deployResponse2.startsWith('"Success')) {
        log("Unable to deploy", "error");
        process.exit();
      }
    } catch (err) {
      log("Unable to deploy", "error");
      console.log(err);
      process.exit();
    }

    try {
      await new Promise((resolve, reject) => {
        let over = false;
        setTimeout(() => {
          if (!over) {
            over = true;
            reject(
              "Timeout error, waited 8 seconds for GRPC response. Skipping."
            );
          }
        }, 8000);
        rchainToolkit.grpc.propose({}, grpcProposeClient).then(a => {
          if (!over) {
            over = true;
            resolve();
          }
        });
      });
    } catch (err) {
      log("Unable to propose, skip propose", "warning");
      console.log(err);
    }

    let checkingDataOnChain = false;
    log(
      `file address should be : ${dataAtNameResponseExpr1.filesRegistryUri.replace(
        "rho:id:",
        ""
      )}.${fileId}\n`
    );
    log("Now trying to get file from the blockchain...");

    const checkDataOnChain = async () => {
      if (checkingDataOnChain) {
        return;
      }

      const exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
        httpUrlReadOnly,
        {
          term: rholangFilesModuleResourceTerm(
            dataAtNameResponseExpr1.filesRegistryUri.replace("rho:id:", ""),
            fileId
          )
        }
      );

      const parsedResponse = JSON.parse(exploreDeployResponse);
      if (!parsedResponse || !parsedResponse.expr[0]) {
        log("Error retreiving transaction data, will retry in 15 seconds");
        return;
      }

      const jsValue2 = rchainToolkit.utils.rhoValToJs(parsedResponse.expr[0]);

      if (jsValue2) {
        if (jsValue2 === dpy) {
          log(`Deploy successful !`);
          log(
            `registryUri :       ${dataAtNameResponseExpr1.filesRegistryUri.replace(
              "rho:id:",
              ""
            )}`
          );
          log(
            `registryUriEntry :  ${dataAtNameResponseExpr1.entryRegistryUri.replace(
              "rho:id:",
              ""
            )}`
          );
          log(
            `address :           ${dataAtNameResponseExpr1.filesRegistryUri.replace(
              "rho:id:",
              ""
            )}.${fileId}\n`
          );
        } else {
          if (typeof jsValue2 === "string") {
            log(
              "Something went wrong, value of the file on chain is not the same as value sent, value(0-40)",
              "error"
            );
            console.log(jsValue2.substr(0, 40) + "...");
            log("Should be (0-40):", "error");
            console.log(dpy.substr(0, 40) + "...");
          } else {
            log(
              "Something went wrong, value of the file on chain is not the same as value sent, value :",
              "error"
            );
            console.log(jsValue2);
            log("Should be (0-40):", "error");
            console.log(dpy.substr(0, 40) + "...");
          }
        }
        process.exit();
      } else {
        log("Error retreiving transaction data, will retry in 15 seconds");
        return;
      }
    };

    setInterval(checkDataOnChain, 15000);
    checkDataOnChain();
  };

  push();
};
