const fs = require("fs");
const zlib = require("zlib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");

const {
  checkConfigFile,
  createFile,
  createSignature,
  privateKeyPrompt,
  logDappy,
  buildUnforgeableNameQuery,
  extToMimeType,
  getProcessArgv
} = require("./utils");

module.exports.pushFile = async () => {
  logDappy();

  const log = a => {
    console.log(new Date().toISOString(), a);
  };

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

  log("host : " + config.options.host);
  log("port : " + config.options.port);

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

  log("Compiling !");

  let pushFile;
  try {
    pushFile = fs.readFileSync(`push.rho`, "utf8");
    log("Using push.rho file from your directory");
  } catch (err) {
    pushFile = fs.readFileSync(`${__dirname}/push.rho`, "utf8");
    log("Using default push.rho file from dappy-cli");
  }

  const filePath = getProcessArgv("--file");
  if (!filePath) {
    log("error : --file argument not found");
    process.exit();
  }

  let fileToPush;
  try {
    fileToPush = fs.readFileSync(filePath);
  } catch (err) {
    log(`error : ${filePath} not found in the directory`);
    process.exit();
  }

  let mimeType = getProcessArgv("--mimeType");
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
        `error : could not infer mimeType based on extension ${extension}, please set a mimeType using the --mimeType parameter`
      );
      process.exit();
    }
  }

  const pathsSPlitted = filePath.split("/");
  const name = pathsSPlitted[pathsSPlitted.length - 1];

  const fileAsString = fileToPush.toString("base64");
  const signature = createSignature(fileAsString, mimeType, name, privateKey);
  const file = createFile(fileAsString, mimeType, name, signature + "a");
  const fileGZipped = zlib.gzipSync(file).toString("base64");

  const pushFileOnChain = async () => {
    const timestamp = new Date().valueOf();

    let grpcClient;
    try {
      grpcClient = await rchainToolkit.grpc.getGrpcDeployClient(
        `${config.options.host}:${config.options.port}`,
        grpc,
        protoLoader
      );
    } catch (err) {
      console.log(err);
      process.exit();
    }

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      `${config.options.host}:${config.options.port}`,
      grpc,
      protoLoader
    );

    const term = pushFile
      .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
      .replace("DAPPY_FILE", fileGZipped);

    const phloPrice = 1;

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
    if (
      !lastFinalizedBlock.blockInfo ||
      !lastFinalizedBlock.blockInfo.blockNumber
    ) {
      log("Could not get blockNumber from last finalized block");
      process.exit();
    }

    const deployData = await rchainToolkit.utils.getDeployData(
      "secp256k1",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      parseInt(lastFinalizedBlock.blockInfo.blockNumber)
    );

    let privateNamePreviewResponse;
    try {
      privateNamePreviewResponse = await rchainToolkit.grpc.previewPrivateNames(
        {
          user: Buffer.from(publicKey, "hex"),
          timestamp: timestamp,
          nameQty: 1
        },
        grpcClient
      );
    } catch (err) {
      log("Unable to preview private name");
      console.log(err);
      process.exit();
    }

    let unforgeableNameFromNode;
    try {
      unforgeableNameFromNode = rchainToolkit.utils.unforgeableWithId(
        privateNamePreviewResponse.payload.ids[0]
      );
    } catch (err) {
      log("Unable to preview private name");
      console.log(err);
      process.exit();
    }

    try {
      await rchainToolkit.grpc.doDeploy(deployData, grpcClient);
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

    await new Promise(resolve => {
      setTimeout(resolve, 3000);
    });

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      unforgeableNameFromNode
    );

    let listenForDataAtNameResponse;
    try {
      listenForDataAtNameResponse = await rchainToolkit.grpc.listenForDataAtName(
        {
          name: unforgeableNameQuery,
          depth: 1000
        },
        grpcClient
      );
    } catch (err) {
      log("Cannot retreive transaction data");
      console.log(err);
      process.exit();
    }
    console.log(listenForDataAtNameResponse);
    const data = rchainToolkit.utils.getValueFromBlocks(
      listenForDataAtNameResponse.payload.blockInfo
    );

    if (!data.exprs.length) {
      log("Transaction data not found");
      process.exit();
      return;
    }

    const jsObject = rchainToolkit.utils.rhoValToJs(data);

    log(`Deploy successful !`);
    log(
      `registry_uri :        ${jsObject.registry_uri.replace("rho:id:", "")}`
    );
    log(`unforgeable_name_id : ${jsObject.unforgeable_name[0].gPrivate}\n`);
    process.exit();
  };

  pushFileOnChain();
};
