const fs = require("fs");
const zlib = require("zlib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");

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
  getProcessArgv
} = require("./utils");

module.exports.push = async () => {
  logDappy();

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const log = a => {
    console.log(new Date().toISOString(), a);
  };

  let pushFile;
  try {
    pushFile = fs.readFileSync(`push.rho`, "utf8");
    log("Using push.rho file from your directory");
  } catch (err) {
    pushFile = fs.readFileSync(`${__dirname}/push.rho`, "utf8");
    log("Using default push.rho file from dappy-cli");
  }

  let base64;
  let jsonStringified;

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

  log("host : " + config.options.host);
  log("port (GRPC): " + config.options.port);
  log("port (HTTP): " + config.options.httpPort);

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }
  const publicKey = config.options.public_key;

  log("publicKey : " + publicKey);

  let phloLimit = getProcessArgv("--phlo-limit");
  if (!phloLimit) {
    log("default phlo limit to " + 1000000);
    phloLimit = 1000000;
  } else {
    phloLimit = parseInt(phloLimit);
  }

  fs.watchFile(config.manifest.jsPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    createManifest();
  });

  log("Compiling !");

  const push = async () => {
    const httpUrl = `${config.options.host}:${config.options.httpPort}`;
    const timestamp = new Date().valueOf();

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      `${config.options.host}:${config.options.port}`,
      grpc,
      protoLoader
    );

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    let grpcClient;
    try {
      grpcClient = await rchainToolkit.grpc.getClient(
        `${config.options.host}:${config.options.port}`,
        grpc,
        protoLoader,
        "deployService"
      );
    } catch (err) {
      console.log(err);
      process.exit();
    }
    let lastFinalizedBlock;
    try {
      lastFinalizedBlock = await rchainToolkit.grpc.lastFinalizedBlock(
        grpcClient
      );
    } catch (err) {
      log("Unable to get last finalized block");
      console.log(err);
      process.exit();
    }

    let prepareDeployResponse;
    try {
      prepareDeployResponse = await rchainToolkit.http.prepareDeploy(httpUrl, {
        deployer: publicKey,
        timestamp: timestamp,
        nameQty: 1
      });
    } catch (err) {
      console.log("Unable to prepare deploy");
      console.log(err);
      process.exit();
    }

    if (htmlWithTags.includes("UNFORGEABLE_NAME_1")) {
      try {
        htmlWithTags = htmlWithTags.replace(
          "UNFORGEABLE_NAME_1",
          JSON.parse(prepareDeployResponse).names[0]
        );
      } catch (err) {}
    }

    base64 = createBase64(htmlWithTags);
    const signature = createSignature(base64, mimeType, name, privateKey);

    let dpy = createFile(base64, mimeType, name, signature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);
    const term = pushFile
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress)
      .replace("DAPPY_FILE", dpy);

    const phloPrice = 1;
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      "secp256k1",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      parseInt(lastFinalizedBlock.blockInfo.blockNumber) || -1
    );

    fs.writeFileSync(name, dpy, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync(name);
    const dpyFileSize = stats.size / 1000;
    log(`${name} created : ` + dpyFileSize + "ko");

    try {
      const deployResponse = await rchainToolkit.http.deploy(
        httpUrl,
        deployOptions
      );
      if (deployResponse.error) {
        log("Unable to deploy");
        console.log(deployResponse.error.messages);
        process.exit();
      }
    } catch (err) {
      log("Unable to deploy");
      console.log(err);
      process.exit();
    }

    try {
      await rchainToolkit.grpc.propose({}, grpcProposeClient);
    } catch (err) {
      log("Unable to propose");
      console.log(err);
      process.exit();
    }

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      JSON.parse(prepareDeployResponse).names[0]
    );

    await new Promise(r => {
      setTimeout(r, 3000);
    });

    let dataAtNameResponse;
    try {
      dataAtNameResponse = await rchainToolkit.http.dataAtName(httpUrl, {
        name: unforgeableNameQuery,
        depth: 90
      });
    } catch (err) {
      log("Cannot retreive transaction data");
      console.log(err);
      process.exit();
    }

    const parsedResponse = JSON.parse(dataAtNameResponse);

    if (!parsedResponse.exprs.length) {
      log("Transaction data not found");
      process.exit();
    }

    const jsObject = rchainToolkit.utils.rhoValToJs(
      parsedResponse.exprs[0].expr
    );

    log(`Deploy successful !`);
    log(
      `registry_uri :        ${jsObject.registry_uri.replace("rho:id:", "")}`
    );
    log(`unforgeable_name_id : ${jsObject.unforgeable_name.UnforgPrivate}\n`);
    process.exit();
  };

  push();
};
