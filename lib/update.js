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
  buildUnforgeableNameQuery,
  createSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy,
  getProcessArgv
} = require("./utils");

module.exports.update = async () => {
  logDappy();

  const WATCH = !!process.argv.find(a => a === "--watch");

  const configFile = fs.readFileSync("dappy.config.json", "utf8");

  const updateFile = fs.readFileSync(`${__dirname}/update.rho`, "utf8");

  let base64;
  let jsonStringified;

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
  const httpUrl = `${config.options.host}:${config.options.httpPort}`;

  checkConfigFile(config);

  log("host : " + config.options.host);
  log("port : " + config.options.port);

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }

  const publicKey = config.options.public_key;
  const registryUri = config.options.registry_uri;
  let unforgeableNameId = config.options.unforgeable_name_id;
  if (unforgeableNameId && unforgeableNameId.startsWith("0x")) {
    unforgeableNameId = unforgeableNameId.slice(2);
  }

  if (!registryUri) {
    log(
      "Error : In order to update the manifest, you must provide a registry_uri in dappy.config.json"
    );
    process.exit();
  }
  if (!unforgeableNameId) {
    log(
      "Error : In order to update the manifest, you must provide a unforgeable_name_id in dappy.config.json"
    );
    process.exit();
  }

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

  fs.watchFile(config.manifest.htmlPath, () => {
    createManifest();
  });

  if (WATCH) {
    log("Watching for file changes !");
  } else {
    log("Compiling !");
  }

  const createManifest = async () => {
    const timestamp = new Date().valueOf();

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

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      `${config.options.host}:${config.options.port}`,
      grpc,
      protoLoader
    );

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

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
      log(
        "Warning : will replace UNFORGEABLE_NAME_1 with a newly previewed unforgeable name"
      );
      htmlWithTags = htmlWithTags.replace(
        "UNFORGEABLE_NAME_1",
        JSON.parse(prepareDeployResponse).names[0]
      );
    }

    base64 = createBase64(htmlWithTags);
    const signature = createSignature(base64, mimeType, name, privateKey);

    let dpy = createFile(base64, mimeType, name, signature);
    dpy = zlib.gzipSync(dpy).toString("base64");

    const revAddress = rchainToolkit.utils.revAddressFromPublicKey(publicKey);
    const term = updateFile
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace(new RegExp("REV_ADDRESS", "g"), revAddress)
      .replace("DAPPY_FILE", dpy)
      .replace("REGISTRY_URI", registryUri)
      .replace("SIGNATURE", "SIG");

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
      console.log("Unable to propose");
      console.log(err);
      process.exit();
    }

    await new Promise(resolve => {
      setTimeout(resolve, 3000);
    });

    const unforgeableNameQuery = buildUnforgeableNameQuery(unforgeableNameId);

    let listenForDataAtNameResponse;
    try {
      listenForDataAtNameResponse = await rchainToolkit.http.dataAtName(
        httpUrl,
        {
          name: unforgeableNameQuery,
          depth: 90
        }
      );
    } catch (err) {
      log("Cannot retreive transaction data");
      console.log(err);
      process.exit();
    }

    const parsedResponse = JSON.parse(listenForDataAtNameResponse);

    const jsExpr = rchainToolkit.utils.rhoValToJs(parsedResponse.exprs[0].expr);
    if (jsExpr === dpy) {
      log(`Update successful !`);
    } else {
      log("Failed to verify the updated code");
    }
    process.exit();
  };

  createManifest();
};
