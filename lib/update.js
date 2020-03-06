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
  getProcessArgv,
  rholangFilesModuleResourceTerm,
  log
} = require("./utils");

module.exports.update = async () => {
  log("Update not implemented yet", "error");
  log("See https://github.com/fabcotech/rholang-files-module developments");
  process.exit();
  logDappy();

  const WATCH = !!process.argv.find(a => a === "--watch");

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const updateFile = fs.readFileSync(`${__dirname}/update.rho`, "utf8");

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
    const grpcUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostgrpcProposePort}`;
    const timestamp = new Date().valueOf();

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

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      grpcUrlValidator.replace("http://", "").replace("https://", ""),
      grpc,
      protoLoader
    );

    const fileId = config.manifest.fileId || "index";

    const exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
      httpUrlReadOnly,
      {
        term: rholangFilesModuleResourceTerm(registryUri, fileId)
      }
    );

    const jsValue = rchainToolkit.utils.rhoValToJs(
      exploreDeployResponse.exprs[0].expr
    );

    if (!jsValue || !jsValue.entryRegistryUri) {
      log("Files module should have key entryRegistryUri", "error");
      console.log(jsValue);
      process.exit();
    }

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    htmlWithTags = htmlWithTags.replace(
      new RegExp("REGISTRY_URI", "g"),
      registryUri
    );
    htmlWithTags = htmlWithTags.replace(
      new RegExp("FULL_ADDRESS", "g"),
      `${registryUri}.${fileId}`
    );

    base64 = createBase64(htmlWithTags);
    const signature = createSignature(base64, mimeType, name, privateKey);

    let dpy = createFile(base64, mimeType, name, signature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);
    let term = updateFile
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress)
      .replace(new RegExp("FILE_ID", "g"), fileId)
      .replace(new RegExp("REGISTRY_URI", "g"), jsValue.entryRegistryUri)
      .replace(
        new RegExp("SIGNATURE", "g"),
        generateSignatureForNonce(jsValue.nonce, privateKey)
      )
      .replace("DAPPY_FILE", dpy);

    if (term.indexOf("NONCE") !== -1) {
      const nonce = uuidv4().replace(/-/g, "");
      log('Replaced "NONCE" (found in rholang), with ' + nonce);
      term = term.replace(new RegExp("NONCE", "g"), nonce);
    }

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
      const deployResponse = await rchainToolkit.http.deploy(
        httpUrlValidator,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success')) {
        log("Unable to deploy", "error");
        console.log(deployResponse);
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
    const checkDataOnChain = async () => {
      if (checkingDataOnChain) {
        return;
      }

      /*       const exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
        httpUrlReadOnly,
        {
          term: rholangFilesModuleResourceTerm(jsValue.entryRegistryUri, fileId)
        }
      );

      const jsValue2 = rchainToolkit.utils.rhoValToJs(
        exploreDeployResponse.exprs[0].expr
      ); */
      const jsValue2 = "aaa";

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

  update();
};
