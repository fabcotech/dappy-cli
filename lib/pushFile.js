const fs = require("fs");
const zlib = require("zlib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");
const uuidv4 = require("uuid/v4");

const {
  checkConfigFile,
  createFile,
  createSignature,
  privateKeyPrompt,
  logDappy,
  buildUnforgeableNameQuery,
  rholangFilesModuleTerm,
  extToMimeType,
  getProcessArgv,
  log,
} = require("./utils");

module.exports.pushFile = async () => {
  logDappy();

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

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

  log("Compiling !");

  let pushFile;
  try {
    pushFile = fs.readFileSync(`push.rho`, "utf8");
    log("Using push.rho file from your directory");
  } catch (err) {
    log("Using default push.rho file from dappy-cli");
  }

  const filePath = getProcessArgv("--file");
  if (!filePath) {
    log("error : --file argument not found", "error");
    process.exit();
  }

  let fileToPush;
  try {
    fileToPush = fs.readFileSync(filePath);
  } catch (err) {
    log(`error : ${filePath} not found in the directory`, "error");
    process.exit();
  }

  let mimeType = getProcessArgv("--mime-type");
  if (!mimeType) {
    log(
      `mimeType argument will be based on the extension of the file ${filePath}`
    );
  }

  const pathSplitted = filePath.split(".");
  const extension = pathSplitted[pathSplitted.length - 1];
  if (!mimeType) {
    mimeType =
      extToMimeType(extension) ||
      extToMimeType(extension.toLowerCase()) ||
      extToMimeType(extension.toUpperCase());
    if (!mimeType) {
      log(
        `error : could not infer mimeType based on extension ${extension}, please set a mimeType using the --mime-type parameter`,
        "error"
      );
      process.exit();
    }
  }

  const pathsSPlitted = filePath.split("/");
  const name = pathsSPlitted[pathsSPlitted.length - 1];

  const fileAsString = fileToPush.toString("base64");
  const signature = createSignature(fileAsString, mimeType, name, privateKey);
  const file = createFile(fileAsString, mimeType, name, signature);
  const fileAsBase64 = zlib.gzipSync(file).toString("base64");

  const pushFileOnChain = async () => {
    console.log('not supported anymore, please use dappy browser for now');
    process.exit();
    const httpUrlReadOnly = `${config.options.readOnlyHost}:${config.options.readOnlyHostHttpPort}`;
    const httpUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostHttpPort}`;
    const grpcUrlValidator = `${config.options.validatorHost}:${config.options.validatorHostgrpcProposePort}`;

    const timestamp = new Date().valueOf();

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      grpcUrlValidator.replace("http://", "").replace("https://", ""),
      grpc,
      protoLoader
    );

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
    const nonce = uuidv4().replace(/-/g, "");

    let term;
    if (pushFile) {
      term = pushFile;
    } else {
      term = rholangFilesModuleTerm(publicKey, nonce, {
        fileAsBase64: fileAsBase64,
        fileId: fileId,
      });
    }

    term = term.replace(new RegExp("PUBLIC_KEY", "g"), publicKey);
    while (term.indexOf("NONCE") !== -1) {
      const nonce = uuidv4().replace(/-/g, "");
      log('Replaced "NONCE" (found in rholang), with ' + nonce);
      term = term.replace("NONCE", nonce);
    }

    const phloPrice = 1;

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
      console.log("Unable to prepare deploy", "error");
      console.log(err);
      process.exit();
    }

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
        rchainToolkit.grpc.propose({}, grpcProposeClient).then((a) => {
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
      checkingDataOnChain = true;
      const unforgeableNameQuery = buildUnforgeableNameQuery(
        JSON.parse(prepareDeployResponse).names[0]
      );

      let dataAtNameResponse;
      try {
        dataAtNameResponse = await rchainToolkit.http.dataAtName(
          httpUrlReadOnly,
          {
            name: unforgeableNameQuery,
            depth: 3,
          }
        );
      } catch (err) {
        checkingDataOnChain = false;
        log("Transaction data not found, will retry in 15 seconds");
        console.log(err);
        return;
      }
      checkingDataOnChain = false;

      const parsedResponse = JSON.parse(dataAtNameResponse);

      if (!parsedResponse.exprs.length) {
        log("Transaction data not found, will retry in 15 seconds");
        return;
      }

      const jsValue = rchainToolkit.utils.rhoValToJs(
        parsedResponse.exprs[0].expr
      );

      log(`Deploy successful !`);
      log(`registryUri :       ${jsValue.registryUri.replace("rho:id:", "")}`);
      log(
        `address :           ${jsValue.registryUri.replace(
          "rho:id:",
          ""
        )}.${fileId}\n`
      );
      process.exit();
    };

    setInterval(checkDataOnChain, 15000);
    checkDataOnChain();
  };

  pushFileOnChain();
};
