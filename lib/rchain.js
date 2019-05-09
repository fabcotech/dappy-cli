const nacl = require("tweetnacl");
const { blake2bInit, blake2bUpdate, blake2bFinal } = require("blakejs");

const {
  ListeningNameDataResponse,
  DeployData
} = require("./protobuf/CasperMessage").coop.rchain.casper.protocol;

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

module.exports.getValueFromBlocks = blocks =>
  new Promise((resolve, reject) => {
    for (let i = 0; i < blocks.blockResults.length; i += 1) {
      const block = blocks.blockResults[i];
      for (let j = 0; j < block.postBlockData.length; j += 1) {
        const data = block.postBlockData[j].exprs[0];
        if (data) {
          resolve(data);
          return;
        }
      }
    }
    reject("Not data found in any block");
  });

module.exports.rholangMapToJsObject = map => {
  const obj = {};
  map.kvs.forEach(kv => {
    const k = kv.key.exprs[0].g_string;
    const val = kv.value.exprs[0];
    if (val.g_string) {
      obj[k] = val.g_string;
    } else if (val.hasOwnProperty("g_bool")) {
      obj[k] = val.g_bool;
    } else if (val.g_int) {
      obj[k] = val.g_int;
    }
  });

  return obj;
};

module.exports.parseEither = either => {
  if (either && either.success && either.success.response) {
    const json = JSON.stringify(either.success.response.value);
    const d = ListeningNameDataResponse.decode(JSON.parse(json).data);
    return d;
  } else {
    throw new Error("error: GRPC error");
  }
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

module.exports.deployDataToSign = p => {
  return DeployData.encode({
    ...p,
    deployer: null,
    sig: null,
    sigAlgorithm: null
  }).finish();
};

module.exports.getBlake2Hash = a => {
  const context = blake2bInit(32, null);
  blake2bUpdate(context, a);
  return blake2bFinal(context);
};

module.exports.sign = (hash, privateKey) => {
  return nacl.sign.detached(hash, Buffer.from(privateKey, "hex"));
};

module.exports.getDeployData = (
  timestamp,
  term,
  privateKey,
  publicKey,
  phloPrice = 1,
  phloLimit = 10000
) => {
  const p = module.exports.payment(timestamp, term, phloPrice, phloLimit);
  const toSign = module.exports.deployDataToSign(p);

  const hash = module.exports.getBlake2Hash(new Uint8Array(toSign));
  const signature = module.exports.sign(hash, privateKey);

  return {
    ...p,
    deployer: Buffer.from(publicKey, "hex"),
    sig: new Uint8Array(Buffer.from(signature)),
    sigAlgorithm: "ed25519"
  };
};
