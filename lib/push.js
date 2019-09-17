const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");

const {
  checkConfigFile,
  createDpy,
  sanitizeFileName,
  createBase64,
  createSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy,
  buildUnforgeableNameQuery
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
    log("Using default push.rho file from your dappy-cli");
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
  log("port : " + config.options.port);

  let privateKey = config.options.private_key;
  if (!privateKey) {
    privateKey = await privateKeyPrompt();
  }
  const publicKey = config.options.public_key;

  log("publicKey : " + publicKey);

  fs.watchFile(config.manifest.jsPath, () => {
    createManifest();
  });

  fs.watchFile(config.manifest.cssPath, () => {
    createManifest();
  });

  log("Compiling !");

  const createManifest = async () => {
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

    const mimeType = "application/dappy";
    const name = `${sanitizeFileName(config.manifest.title)}.dpy`;
    htmlWithTags = createHtmlWithTags(config);

    if (htmlWithTags.includes("UNFORGEABLE_NAME_1")) {
      const unforgeableNames = [];
      try {
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
          console.log("Unable to preview private name");
          console.log(err);
          process.exit();
        }

        let privateNameFromNode;
        try {
          privateNameFromNode = rchainToolkit.utils.unforgeableWithId(
            privateNamePreviewResponse.ids[0]
          );
        } catch (err) {
          console.log("Unable to preview private name");
          process.exit();
        }

        unforgeableNames[0] = privateNameFromNode;
        htmlWithTags = htmlWithTags.replace(
          "UNFORGEABLE_NAME_1",
          unforgeableNames[0]
        );
      } catch (err) {}
    }

    base64 = createBase64(htmlWithTags);
    const signature = createSignature(base64, mimeType, name, privateKey);

    const dpy = createDpy(base64, mimeType, name, signature);

    const term = pushFile
      .replace("PUBLIC_KEY", publicKey)
      .replace("MANIFEST", dpy);

    const phloPrice = 1;
    const phloLimit = 1000000;
    const validAfterBlock = -1;

    const deployData = await rchainToolkit.utils.getDeployData(
      "secp256k1",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      validAfterBlock
    );

    fs.writeFileSync(name, dpy, err => {
      if (err) {
        console.error(err);
      }
    });
    const stats = fs.statSync(name);
    const dpyFileSize = stats.size / 1000;
    log(`${name} created : ` + dpyFileSize + "ko");

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
        privateNamePreviewResponse.ids[0]
      );
    } catch (err) {
      log("Unable to preview private name");
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
      await rchainToolkit.grpc.propose(deployData, grpcProposeClient);
    } catch (err) {
      log("Unable to propose");
      console.log(err);
      process.exit();
    }

    await new Promise(resolve => {
      setTimeout(resolve, 6000);
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

    const data = rchainToolkit.utils.getValueFromBlocks(
      listenForDataAtNameResponse.blockResults
    );

    if (!data.exprs.length) {
      log("Transaction data not found");
      process.exit();
      return;
    }

    const jsObject = rchainToolkit.utils.rholangMapToJsObject(
      data.exprs[0].eMapBody
    );

    log(`Deploy successful !`);
    log(
      `registry_uri :        ${jsObject.registry_uri.replace("rho:id:", "")}`
    );
    log(`unforgeable_name_id : ${jsObject.unforgeable_name[0].gPrivate}\n`);
    process.exit();
  };

  createManifest();
};
