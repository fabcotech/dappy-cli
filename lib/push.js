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
    let masterRegistryUri = config.options.masterRegistryUri;
    if (!masterRegistryUri) {
      log("deploying rchain-token master first");
      const term = rchainToken.masterTerm({
        depth: 3,
        contractDepth: 2,
      });

      let dataAtNameResponse;
      try {
        dataAtNameResponse = await rchainToolkit.http.easyDeploy(
          httpUrlValidator,
          term,
          privateKey,
          1,
          10000000,
          8 * 60 * 1000
        );
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }

      const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
      );

      masterRegistryUri = data.registryUri.replace("rho:id:", "");
      console.log("\n");
      log("  Master registry URI is " + masterRegistryUri);
      log("  Add the following in dappy.config.json :");
      log('  "masterRegistryUri": "' + masterRegistryUri + '"');
      console.log("\n");
    }

    let boxId = config.options.boxId;
    if (!boxId) {
      log("please provide .boxId in dappy.config.json");
      log("if it does not exist in aster contract, it will be created");
      process.exit();
    } else {
      const term = rchainToken.readBoxTerm({
        masterRegistryUri: masterRegistryUri,
        boxId: boxId,
      });
      const result0 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
        term: term,
      });

      const boxData = rchainToolkit.utils.rhoValToJs(
        JSON.parse(result0).expr[0]
      );
      if (boxData === "error: box not found") {
        log("deploying box now");
        const term2 = rchainToken.deployBoxTerm({
          publicKey: publicKey,
          boxId: boxId,
          masterRegistryUri: masterRegistryUri,
        });

        let dataAtNameResponse;
        try {
          dataAtNameResponse = await rchainToolkit.http.easyDeploy(
            httpUrlValidator,
            term2,
            privateKey,
            1,
            10000000,
            8 * 60 * 1000
          );
        } catch (err) {
          console.log(err);
          throw new Error(err);
        }

        const data = rchainToolkit.utils.rhoValToJs(
          JSON.parse(dataAtNameResponse).exprs[0].expr
        );
        boxId = data.boxId;

        if (data.status !== "completed") {
          console.log(data);
          process.exit();
        }
        log('box "' + boxId + '" deployed in master contract');
      } else {
        log("box found");
      }
    }

    let contractId = config.options.contractId;
    if (!contractId) {
      log("please provide .contractId in dappy.config.json");
      process.exit();
    } else {
      const term = rchainToken.readConfigTerm({
        masterRegistryUri,
        contractId,
      });
      const result = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
        term: term,
      });

      if (typeof JSON.parse(result).expr[0] === "undefined") {
        const term2 = rchainToken.deployTerm({
          masterRegistryUri: masterRegistryUri,
          fungible: false,
          boxId: boxId,
          contractId: contractId,
          fee: null,
        });

        let dataAtNameResponse;
        try {
          dataAtNameResponse = await rchainToolkit.http.easyDeploy(
            httpUrlValidator,
            term2,
            privateKey,
            1,
            10000000,
            8 * 60 * 1000
          );
        } catch (err) {
          console.log(err);
          throw new Error(err);
        }

        const data = rchainToolkit.utils.rhoValToJs(
          JSON.parse(dataAtNameResponse).exprs[0].expr
        );

        if (data.status !== "completed") {
          console.log(data);
          throw new Error();
        }
        contractId = data.contractId;
        log("contract " + contractId + " deployed in master contract");
      }
    }

    const purseId = config.options.purseId;
    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(purseId)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);
    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);

    htmlWithTags = htmlWithTags
      .replace(new RegExp("MASTER_REGISTRY_URI", "g"), masterRegistryUri)
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(
        new RegExp("FULL_ADDRESS", "g"),
        `${masterRegistryUri}.${contractId}.${purseId}`
      )
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress);

    base64 = createBase64(htmlWithTags);
    const fileSignature = createSignature(base64, mimeType, name, privateKey);
    let dpy = createFile(base64, mimeType, name, fileSignature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    let term;
    if (!purseId) {
      log("please provide .purseId in dappy.config.json");
      process.exit();
    } else {
      const term2 = rchainToken.readPursesTerm({
        masterRegistryUri: masterRegistryUri,
        contractId: contractId,
        pursesIds: [purseId],
      });
      const result = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
        term: term2,
      });

      const data = rchainToolkit.utils.rhoValToJs(JSON.parse(result).expr[0]);
      if (Object.keys(data).length === 0) {
        log("purse " + purseId + " not found, lets create it");
        log("will do rchain-token.CREATE_PURSES operation");
        const payload = {
          purses: {
            [purseId]: {
              id: purseId,
              boxId: boxId,
              quantity: 1,
              price: null,
            },
          },
          data: {
            [`${purseId}`]: encodeURI(dpy),
          },
          masterRegistryUri: masterRegistryUri,
          contractId: contractId,
          boxId: boxId,
        };
        term = rchainToken.createPursesTerm(payload);
      } else {
        log("purse " + purseId + " found in contract, just update purse data");
        log("will do rchain-token.UPDATE_PURSE_DATA operation");
        const payload = {
          masterRegistryUri: masterRegistryUri,
          purseId: purseId,
          boxId: boxId,
          contractId: contractId,
          data: encodeURI(dpy),
        };

        term = rchainToken.updatePurseDataTerm(payload);
      }
    }

    let dataAtNameResponse;
    try {
      dataAtNameResponse = await rchainToolkit.http.easyDeploy(
        httpUrlValidator,
        term,
        privateKey,
        1,
        10000000,
        8 * 60 * 1000
      );
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }

    const data = rchainToolkit.utils.rhoValToJs(
      JSON.parse(dataAtNameResponse).exprs[0].expr
    );

    if (data.status !== "completed") {
      console.log(data);
      throw new Error();
    }

    log("Now trying to get file/nft from the blockchain...");

    let checkingDataOnChain = false;
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
            term: rchainToken.readPursesDataTerm({
              contractId,
              masterRegistryUri,
              pursesIds: [purseId],
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
        if (jsValue2[purseId] === dpy) {
          log(`Deploy successful !`);
          log(`masterRegistryUri :                ${masterRegistryUri}`);
          log(`contract id :                      ${contractId}`);
          log(`purse id :                         ${purseId}`);
          log(
            `full address :                     ${masterRegistryUri}.${contractId}.${purseId}`
          );
          log(`shortcut address (d network) :     ${contractId}.${purseId}`);
          log(`Box owning this purse/NFT:         ${boxId}`);
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
