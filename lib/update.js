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
  log,
} = require("./utils");

module.exports.update = async () => {
  logDappy();

  const WATCH = !!process.argv.find((a) => a === "--watch");

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

  log("host (read-only):                   " + config.options.readOnlyHost);
  log(
    "host (read-only) HTTP port:         " + config.options.readOnlyHostHttpPort
  );
  log("host (validator):                   " + config.options.validatorHost);
  log(
    "host (validator) HTTP port:         " +
      config.options.validatorHostHttpPort
  );

  let privateKey = config.options.privateKey;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);
  log("publicKey : " + publicKey);

  const registryUri = config.options.registryUri;

  if (!registryUri) {
    log(
      "In order to update the file, you must provide a registryUri in dappy.config.json",
      "error"
    );
    process.exit();
  }

  log("registryUri : " + registryUri);

  let phloLimit = getProcessArgv("--phlo-limit");
  if (!phloLimit) {
    log("default phlo limit to " + 100000000);
    phloLimit = 100000000;
  } else {
    phloLimit = parseInt(phloLimit);
  }

  fs.watchFile(config.manifest.jsPath, () => {
    update();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    update();
  });

  fs.watchFile(config.manifest.htmlPath, () => {
    update();
  });

  if (WATCH) {
    log("Watching for file changes !");
  } else {
    log("Compiling !");
  }

  const update = async () => {
    const httpUrlReadOnly = `${config.options.readOnlyHost}:${config.options.readOnlyHostHttpPort}`;
    const httpUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostHttpPort}`;
    const timestamp = new Date().valueOf();

    let boxRegistryUri = config.options.boxRegistryUri;
    if (!boxRegistryUri) {
      log("Please have a .boxRegistryUri in dappy.config.json", "error");
      process.exit();
    }
    let validAfterBlockNumber;
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

    const fileId = config.manifest.fileId || "index";

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);

    htmlWithTags = createHtmlWithTags(config);

    htmlWithTags = htmlWithTags
      .replace(new RegExp("REGISTRY_URI", "g"), registryUri)
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(new RegExp("FULL_ADDRESS", "g"), `${registryUri}.${fileId}`)
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress);

    base64 = createBase64(htmlWithTags);
    const dpySignature = createSignature(base64, mimeType, name, privateKey);

    let dpy = createFile(base64, mimeType, name, dpySignature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    const payload = {
      fromBoxRegistryUri: boxRegistryUri,
      purseId: fileId,
      data: encodeURI(dpy),
    };

    const term = rchainToken.updatePurseDataTerm(registryUri, payload);

    const phloPrice = 1;

    validAfterBlockNumber = validAfterBlockNumber || -1;
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      "secp256k1",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      validAfterBlockNumber
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
      const deployResponse = await rchainToolkit.http.deploy(
        httpUrlValidator,
        deployOptions
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

    let checkingDataOnChain = false;
    const checkDataOnChain = async () => {
      if (checkingDataOnChain) {
        return;
      }
      checkingDataOnChain = true;

      const exploreDeployResponse2 = await rchainToolkit.http.exploreDeploy(
        httpUrlReadOnly,
        {
          term: rchainToken.readPursesDataTerm(registryUri, {
            pursesIds: [fileId],
          }),
        }
      );
      checkingDataOnChain = false;

      if (exploreDeployResponse2.includes("out of phlogistons")) {
        log("Something went wrong during explore-deploy", "error");
        console.log(exploreDeployResponse2);
        process.exit();
      }

      const parsedResponse2 = JSON.parse(exploreDeployResponse2);
      if (!parsedResponse2 || !parsedResponse2.expr[0]) {
        log(
          "Transaction data not found (file upload), will retry in 15 seconds"
        );
        return;
      }

      const jsValue2 = rchainToolkit.utils.rhoValToJs(parsedResponse2.expr[0]);
      if (jsValue2) {
        if (jsValue2[fileId] === dpy) {
          log(`Deploy successful !`);
          log(`registryUri :       ${registryUri}`);
          log(`address :           ${registryUri}.${fileId}\n`);
          process.exit();
        } else {
          if (typeof jsValue2[fileId] === "string") {
            log(
              jsValue2[fileId].substr(0, 40) +
                "..." +
                " should be: " +
                dpy.substr(0, 40) +
                "..." +
                " probably old value, will retry in 15 seconds"
            );
          } else {
            log(
              "Value on chain is not a string, problem, value (0-40) :",
              "error"
            );
            process.exit();
          }
        }
      } else {
        log("Error retreiving transaction data, will retry in 15 seconds");
        checkingDataOnChain = false;
      }
    };

    setInterval(checkDataOnChain, 15000);
    checkDataOnChain();
  };

  update();
};
