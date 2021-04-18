const fs = require("fs");
const zlib = require("zlib");
const rchainToolkit = require("rchain-toolkit");
const rchainToken = require("rchain-token");

const {
  checkConfigFile,
  createFile,
  sanitizeFileName,
  createBase64,
  createSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy,
  buildUnforgeableNameQuery,
  getProcessArgv,
  waitForUnforgeable,
  log,
} = require("./utils");

module.exports.push = async () => {
  logDappy();

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

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

  log("host (read-only):                   " + config.options.readOnly);
  log("host (validator):                   " + config.options.validator);

  let privateKey = config.options.privateKey;
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

  const httpUrlReadOnly = config.options.readOnly;
  const httpUrlValidator = config.options.validator;

  try {
    validAfterBlockNumber = JSON.parse(
      await rchainToolkit.http.blocks(httpUrlReadOnly, {
        position: 1,
      })
    )[0].blockNumber;
  } catch (err) {
    log("Unable to get last finalized block", "error");
    console.log(err);
    process.exit();
  }

  /* fs.watchFile(config.manifest.jsPath, () => {
    push();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    push();
  }); */

  log("Compiling !");

  const push = async () => {
    let boxRegistryUri = config.options.boxRegistryUri;
    if (!boxRegistryUri) {
      console.log("  deploying box first");
      const term = rchainToken.boxTerm({ publicKey: publicKey });
      const timestampBox = new Date().getTime();
      const pd = await rchainToolkit.http.prepareDeploy(httpUrlReadOnly, {
        deployer: publicKey,
        timestamp: timestampBox,
        nameQty: 1,
      });

      const deployOptions = await rchainToolkit.utils.getDeployOptions(
        "secp256k1",
        timestampBox,
        term,
        privateKey,
        publicKey,
        1,
        1000000,
        validAfterBlockNumber || -1
      );
      try {
        const deployResponse = await rchainToolkit.http.deploy(
          httpUrlValidator,
          deployOptions
        );
        if (!deployResponse.startsWith('"Success!')) {
          console.log(deployResponse);
          throw new Error(deployResponse);
        }
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }

      let dataAtNameResponse;
      try {
        dataAtNameResponse = await waitForUnforgeable(
          JSON.parse(pd).names[0],
          httpUrlReadOnly
        );
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
      const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
      );

      boxRegistryUri = data.registryUri.replace("rho:id:", "");
      console.log("\n");
      log("  Box registry URI is " + boxRegistryUri);
      log("  Add the following in dappy.config.json :");
      log('  "boxRegistryUri": "' + boxRegistryUri + '"');
      console.log("\n");
    }

    const timestamp = new Date().valueOf();
    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    let prepareDeployResponse;
    try {
      prepareDeployResponse = await rchainToolkit.http.prepareDeploy(
        httpUrlReadOnly,
        {
          deployer: publicKey,
          timestamp: timestamp,
          nameQty: 1,
        }
      );
    } catch (err) {
      log("Unable to prepare deploy", "error");
      console.log(err);
      process.exit();
    }

    term1 = rchainToken.mainTerm(boxRegistryUri, {
      fungible: false,
      name: "myfiles",
    });

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
        log("Unable to deploy (1)", "error");
        console.log(deployResponse);
        process.exit();
      }
    } catch (err) {
      log("Unable to deploy (2)", "error");
      console.log(err);
      process.exit();
    }

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      JSON.parse(prepareDeployResponse).names[0]
    );

    let interval;
    let dataAtNameResponseExpr1;
    try {
      dataAtNameResponseExpr1 = await new Promise((resolve, reject) => {
        let i = 0;
        interval = setInterval(() => {
          i += 1;
          if (i > 192) {
            reject("48 minutes timeout exceeded");
            return;
          }

          try {
            rchainToolkit.http
              .dataAtName(httpUrlReadOnly, {
                name: unforgeableNameQuery,
                depth: 3,
              })
              .then((dataAtNameResponse) => {
                const parsedResponse = JSON.parse(dataAtNameResponse);
                if (!parsedResponse.exprs.length) {
                  log(
                    "Transaction data not found (rchain-token deployment), will retry in 15 seconds"
                  );
                  return;
                }

                const jsValue = rchainToolkit.utils.rhoValToJs(
                  parsedResponse.exprs[0].expr
                );
                clearInterval(interval);
                resolve(jsValue);
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

    clearInterval(interval);
    const fileId = config.manifest.fileId || "index";

    const contractRegistryUri = dataAtNameResponseExpr1.registryUri.replace(
      "rho:id:",
      ""
    );
    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);

    htmlWithTags = htmlWithTags
      .replace(new RegExp("REGISTRY_URI", "g"), contractRegistryUri)
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(
        new RegExp("FULL_ADDRESS", "g"),
        `${dataAtNameResponseExpr1.registryUri.replace(
          "rho:id:",
          ""
        )}.${fileId}`
      )
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress);

    base64 = createBase64(htmlWithTags);
    const fileSignature = createSignature(base64, mimeType, name, privateKey);
    let dpy = createFile(base64, mimeType, name, fileSignature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    const payload = {
      fromBoxRegistryUri: boxRegistryUri,
      purses: {
        [`${fileId}`]: {
          id: fileId,
          publicKey: publicKey,
          box: `$BQrho:id:${boxRegistryUri}$BQ`,
          price: null,
          type: "0",
          quantity: 1,
        },
      },
      data: {
        [`${fileId}`]: encodeURI(dpy),
      },
    };

    let term2 = rchainToken.createPursesTerm(contractRegistryUri, payload);

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

    fs.writeFileSync(name, dpy, (err) => {
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
        log("Unable to deploy (3)", "error");
        console.log(deployResponse2);
        process.exit();
      }
    } catch (err) {
      log("Unable to deploy (4)", "error");
      console.log(err);
      process.exit();
    }

    let checkingDataOnChain = false;
    log(
      `file address should be : ${dataAtNameResponseExpr1.registryUri.replace(
        "rho:id:",
        ""
      )}.${fileId}\n`
    );
    log("Now trying to get file from the blockchain...");

    const checkDataOnChain = async () => {
      if (checkingDataOnChain) {
        return;
      }
      checkingDataOnChain = true;

      let exploreDeployResponse;
      try {
        exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
          httpUrlReadOnly,
          {
            term: rchainToken.readPursesDataTerm(contractRegistryUri, {
              pursesIds: [fileId],
            }),
          }
        );
      } catch (err) {
        log("Something went wrong during explore-deploy", "error");
        console.log(err);
        process.exit();
      }

      if (exploreDeployResponse.includes("out of phlogistons")) {
        log("Something went wrong during explore-deploy", "error");
        console.log(exploreDeployResponse);
        process.exit();
      }

      checkingDataOnChain = false;
      const parsedResponse = JSON.parse(exploreDeployResponse);

      if (typeof parsedResponse === "string") {
        log("Something went wrong during explore-deploy", "error");
        console.log(parsedResponse);
        process.exit();
      }
      if (!parsedResponse || !parsedResponse.expr[0]) {
        log(
          "Transaction data not found (file upload), will retry in 15 seconds"
        );
        return;
      }

      const jsValue2 = rchainToolkit.utils.rhoValToJs(parsedResponse.expr[0]);

      if (jsValue2) {
        if (jsValue2[fileId] === dpy) {
          log(`Deploy successful !`);
          log(`registryUri :                ${contractRegistryUri}`);
          log(
            `address :                    ${contractRegistryUri}.${fileId}\n`
          );
          log(`Box owning this purse/NFT:   ${boxRegistryUri}`);
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
      }
    };

    setInterval(checkDataOnChain, 15000);
    checkDataOnChain();
  };

  push();
};
