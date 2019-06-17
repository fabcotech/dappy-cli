const nacl = require("tweetnacl");
const { blake2bInit, blake2bUpdate, blake2bFinal } = require("blakejs");
const keccak256 = require("keccak256");
const secp256k1 = require("secp256k1");
const Writer = require("protobufjs").Writer;
const { load } = require("protobufjs");

module.exports.listenForDataAtName = (options, client) => {
  return new Promise((resolve, reject) => {
    client.listenForDataAtName(options, function(err, blocks) {
      if (err) {
        reject(err);
      } else {
        resolve(blocks);
      }
    });
  });
};

module.exports.doDeploy = (options, client) => {
  return new Promise((resolve, reject) => {
    client.DoDeploy(options, function(err, resp) {
      if (err) {
        reject(err);
      } else {
        resolve(resp);
      }
    });
  });
};

module.exports.previewPrivateNames = (options, client) => {
  return new Promise((resolve, reject) => {
    client.previewPrivateNames(options, function(err, blocks) {
      if (err) {
        reject(err);
      } else {
        resolve(blocks);
      }
    });
  });
};

module.exports.createBlock = (options, client) => {
  return new Promise((resolve, reject) => {
    client.createBlock(options, function(err, resp) {
      if (err) {
        reject(err);
      } else {
        resolve(resp);
      }
    });
  });
};

module.exports.toJSData = (par /*: IPar */) /*: Json */ => {
  function recur(p /*: IPar */) {
    if (p.exprs && p.exprs.length > 0) {
      if (p.exprs.length > 1) {
        throw new Error(`${p.exprs.length} exprs not part of RHOCore`);
      }
      const ex = p.exprs[0];
      if (typeof ex.g_bool !== "undefined") {
        return ex.g_bool;
      }
      if (typeof ex.g_int !== "undefined") {
        return ex.g_int;
      }
      if (typeof ex.g_string !== "undefined") {
        return ex.g_string;
      }
      if (
        typeof ex.e_list_body !== "undefined" &&
        ex.e_list_body !== null &&
        Array.isArray(ex.e_list_body.ps)
      ) {
        return ex.e_list_body.ps.map(recur);
      }
      throw new Error(`not RHOCore? ${JSON.stringify(ex)}`);
    } else if (p.sends) {
      const props = p.sends.map(s => {
        const key = recur(s.chan || {});
        if (typeof key !== "string") {
          throw new Error(`not RHOCore? ${JSON.stringify(key)}`);
        }
        const val = recur((s.data || [{}])[0]);
        return { k: key, v: val };
      });
      return props.reduce((acc, { k, v }) => ({ [k]: v, ...acc }), {});
    } else {
      // TODO: check that everything else is empty
      return null;
    }
  }

  return recur(par);
};

module.exports.getValueFromBlocks = blocks => {
  for (let i = 0; i < blocks.blockResults.length; i += 1) {
    const block = blocks.blockResults[i];
    for (let j = 0; j < block.postBlockData.length; j += 1) {
      const data = block.postBlockData[j];
      if (data) {
        return data;
      }
    }
  }
  throw new Error("Not data found in any block");
};

module.exports.rholangMapToJsObject = map => {
  const obj = {};
  map.kvs.forEach(kv => {
    const k = kv.key.exprs[0].g_string;

    const val = kv.value;
    if (val.ids && val.ids[0]) {
      obj[k] = val.ids[0].id;
    } else if (val.exprs && val.exprs[0].g_string) {
      obj[k] = val.exprs[0].g_string;
    } else if (val.exprs && val.exprs[0].g_uri) {
      obj[k] = val.exprs[0].g_uri;
    } else if (val.exprs && val.exprs[0].hasOwnProperty("g_bool")) {
      obj[k] = val.exprs[0].g_bool;
    } else if (val.exprs && val.exprs[0].g_int) {
      obj[k] = val.exprs[0].g_int;
    }
  });

  return obj;
};

module.exports.unforgeableWithId = id => {
  const bytes = Writer.create()
    .bytes(id)
    .finish()
    .slice(1);

  return Buffer.from(bytes).toString("hex");
};

module.exports.parseEitherListeningNameData = either => {
  return new Promise((resolve, reject) => {
    if (either && either.success && either.success.response) {
      load("./protobuf2/DeployService.proto", function(err, root) {
        if (err) {
          reject(err);
          return;
        }
        const ListeningNameDataResponse = root.lookup(
          "ListeningNameDataResponse"
        );
        const b = ListeningNameDataResponse.decode(
          either.success.response.value
        );
        resolve(b);
      });
    } else {
      reject(new Error("error: GRPC error"));
    }
  });
};

module.exports.parseEitherPrivateNamePreview = either => {
  return new Promise((resolve, reject) => {
    if (either && either.success && either.success.response) {
      load("./protobuf2/DeployService.proto", function(err, root) {
        if (err) {
          reject(err);
          return;
        }
        const PrivateNamePreviewResponse = root.lookup(
          "PrivateNamePreviewResponse"
        );
        const b = PrivateNamePreviewResponse.decode(
          either.success.response.value
        );
        resolve(b);
      });
    } else {
      reject(new Error("error: GRPC error"));
    }
  });
};

module.exports.payment = (
  timestamp,
  term,
  phloPrice = 1,
  phloLimit = 10000000
) => {
  return {
    timestamp: timestamp,
    term: term,
    phloLimit: phloLimit,
    phloPrice: phloPrice
  };
};

module.exports.getDeployDataToSign = payment => {
  return new Promise((resolve, reject) => {
    load("./protobuf2/DeployService.proto", function(err, root) {
      if (err) {
        reject(err);
        return;
      }
      const DeployData = root.lookup("DeployData");
      const b = DeployData.encode({
        ...payment,
        deployer: null,
        sig: null,
        sigAlgorithm: null
      }).finish();

      resolve(b);
    });
  });
};

module.exports.getBlake2Hash = a => {
  const context = blake2bInit(32, null);
  blake2bUpdate(context, a);
  return blake2bFinal(context);
};

module.exports.getKeccak256Hash = a => {
  const hash = keccak256(Buffer.from(a));
  return new Uint8Array(hash);
};

module.exports.verifyPrivateAndPublicKey = (privateKey, publicKey) => {
  const publicKeyFromPrivateKey = secp256k1.publicKeyCreate(
    Buffer.from(privateKey, "hex")
  );
  if (publicKeyFromPrivateKey.toString("hex") !== publicKey) {
    throw new Error("Private key and public key do not match");
  }
};

module.exports.signSecp256k1 = (hash, privateKey) => {
  const pubKey = secp256k1.publicKeyCreate(Buffer.from(privateKey, "hex"));
  const sigObj = secp256k1.sign(hash, Buffer.from(privateKey, "hex"));
  if (!secp256k1.verify(hash, sigObj.signature, pubKey)) {
    throw new Error("Signature verification failed");
  }

  console.log(sigObj);
  return sigObj.signature;
};

module.exports.signEd25519 = (hash, privateKey) => {
  return nacl.sign.detached(hash, Buffer.from(privateKey, "hex"));
};

module.exports.getDeployData = async (
  sigAlgorithm,
  timestamp,
  term,
  privateKey,
  publicKey,
  phloPrice = 1,
  phloLimit = 10000
) => {
  const payment = module.exports.payment(timestamp, term, phloPrice, phloLimit);
  const toSign = await module.exports.getDeployDataToSign(payment);
  const hash = module.exports.getBlake2Hash(toSign);

  let signature;
  if (sigAlgorithm === "ed25519") {
    signature = module.exports.signEd25519(hash, privateKey);
  } else if (sigAlgorithm === "secp256k1") {
    signature = module.exports.signSecp256k1(hash, privateKey);
  } else {
    throw new Error("Unsupported algorithm");
  }

  return {
    ...payment,
    deployer: Buffer.from(publicKey, "hex"),
    sig: signature,
    sigAlgorithm: "ed25519"
  };
};
