const fs = require("fs");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");

const {
  checkConfigFile,
  createDpy,
  sanitizeFileName,
  createBase64,
  buildUnforgeableNameQuery,
  createSignature,
  createHtmlWithTags,
  privateKeyPrompt,
  logDappy
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

    let term = updateFile
      .replace("REGISTRY_URI", registryUri)
      .replace("MANIFEST", dpy)
      .replace("SIGNATURE", "SIG");

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

    try {
      await rchainToolkit.grpc.doDeploy(deployData, grpcClient);
    } catch (err) {
      console.log("Unable to deploy");
      console.log(err);
      process.exit();
    }

    try {
      await rchainToolkit.grpc.propose(deployData, grpcProposeClient);
    } catch (err) {
      console.log("Unable to propose");
      console.log(err);
      process.exit();
    }

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      config.options.unforgeable_name_id
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

    if (data && data.exprs && data.exprs[0] && data.exprs[0].gString === dpy) {
      log(`Update successful !`);
    } else {
      log("Failed to verify the updated code");
    }
    process.exit();
  };

  createManifest();
};
