const {
  ListeningNameDataResponse
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
