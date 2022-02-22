const fs = require("fs");
const zlib = require("zlib");
const rchainToolkit = require("rchain-toolkit");
const rchainToken = require("rchain-token");

const {
  createFile,
  sanitizeFileName,
  createBase64,
  createSignature,
  createHtmlWithTags,
  logDappy,
  checkConfig,
  getProcessArgv,
  waitForUnforgeable,
  log,
} = require("./utils");

module.exports.push = async () => {
  logDappy();

  const {
    config,
    privateKey,
    publicKey,
  } = await checkConfig();

  const justBuild = process.argv.findIndex((arg) => arg === '--just-build') !== -1;

  let base64;

  const httpUrlReadOnly = config.options.readOnly;
  const httpUrlValidator = config.options.validator;

  log("Compiling !");

  const push = async () => {

    let masterRegistryUri = config.options.masterRegistryUri;
    if (!masterRegistryUri) {
      throw new Error("please provide .masterRegistryUri in dappy.config.json");
    }
    let contractId = config.options.contractId;
    if (!contractId) {
      throw new Error("please provide .contractId in dappy.config.json");
    }
    let purseId = config.options.purseId;
    if (!purseId) {
      throw new Error("please provide .purseId in dappy.config.json");
    }

    // ===================
    // Build the HTML/DPY FILE
    // ===================

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

    if (justBuild) {
      const path = `./${contractId}.${purseId}.dpy`;
      fs.writeFileSync(path, dpy, 'utf8');
      const stats = fs.statSync(path);
      const dpyFileSize = stats.size / 1000;
      log(`${path} created : ` + dpyFileSize + "ko");
      process.exit();
    }

    // ===================
    // Check master
    // ===================

    if (!masterRegistryUri) {
      log("deploying rchain-token master first");
      const term0 = rchainToken.masterTerm({
        depth: 3,
        contractDepth: 2,
      });

      let dataAtNameResponse0;
      try {
        dataAtNameResponse0 = await rchainToolkit.http.easyDeploy(
          httpUrlValidator,
          term0,
          privateKey,
          1,
          10000000,
          8 * 60 * 1000
        );
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }

      const data0 = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse0).exprs[0].expr
      );

      masterRegistryUri = data0.registryUri.replace("rho:id:", "");
      console.log("\n");
      log("  Master registry URI is " + masterRegistryUri);
      log("  Add the following in dappy.config.json :");
      log('  "masterRegistryUri": "' + masterRegistryUri + '"');
      console.log("\n");
    }

    // ===================
    // Check box
    // ===================

    let boxId = config.options.boxId;
    if (!boxId) {
      throw new Error("Please provide .boxId in dappy.config.json, if it does not exist in aster contract, it will be created");
    }

    const term1 = rchainToken.readBoxTerm({
      masterRegistryUri: masterRegistryUri,
      boxId: boxId,
    });
    const result0 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term1,
    });

    const boxData = rchainToolkit.utils.rhoValToJs(
      JSON.parse(result0).expr[0]
    );
    if (boxData === "error: box not found") {
      log("deploying box now");
      const term2 = rchainToken.deployBoxTerm({
        publicKey: publicKey,
        revAddress: rchainToolkit.utils.revAddressFromPublicKey(publicKey),
        boxId: boxId,
        masterRegistryUri: masterRegistryUri,
      });

      let dataAtNameResponse2;
      try {
        dataAtNameResponse2 = await rchainToolkit.http.easyDeploy(
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

      const data2 = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse2).exprs[0].expr
      );
      boxId = data.boxId;

      if (data2.status !== "completed") {
        console.log(data2);
        process.exit();
      }
      log('box "' + boxId + '" deployed in master contract');
    } else {
      log("box found");
    }

    // ===================
    // Check NFT contract and purse
    // ===================

    const term3 = rchainToken.readConfigTerm({
      masterRegistryUri,
      contractId,
    });
    const result3 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term3,
    });

    if (typeof JSON.parse(result3).expr[0] === "undefined") {
      const term4 = rchainToken.deployTerm({
        masterRegistryUri: masterRegistryUri,
        fungible: false,
        boxId: boxId,
        contractId: contractId,
        fee: null,
      });

      let dataAtNameResponse4;
      try {
        dataAtNameResponse4 = await rchainToolkit.http.easyDeploy(
          httpUrlValidator,
          term4,
          privateKey,
          1,
          10000000,
          8 * 60 * 1000
        );
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }

      const data4 = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse4).exprs[0].expr
      );

      if (data4.status !== "completed") {
        console.log(data4);
        throw new Error();
      }
      contractId = data4.contractId;
      log("contract " + contractId + " deployed in master contract");
    }

    const term5 = rchainToken.readPursesTerm({
      masterRegistryUri: masterRegistryUri,
      contractId: contractId,
      pursesIds: [purseId],
    });
    const result5 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term5,
    });
    const data5 = rchainToolkit.utils.rhoValToJs(JSON.parse(result5).expr[0]);

    let term6;
    if (Object.keys(data5).length === 0) {
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
      term6 = rchainToken.createPursesTerm(payload);
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

      term6 = rchainToken.updatePurseDataTerm(payload);
    }

    let dataAtNameResponse6;
    try {
      dataAtNameResponse6 = await rchainToolkit.http.easyDeploy(
        httpUrlValidator,
        term6,
        privateKey,
        1,
        10000000,
        8 * 60 * 1000
      );
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }

    const data6 = rchainToolkit.utils.rhoValToJs(
      JSON.parse(dataAtNameResponse6).exprs[0].expr
    );

    if (data6.status !== "completed") {
      console.log(data6);
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
