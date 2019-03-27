module.exports.doDeploy = (deployData, client) => {
  return new Promise((resolve, reject) => {
    client.DoDeploy(deployData, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

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

module.exports.createBlock = (options, client) => {
  return new Promise((resolve, reject) => {
    client.createBlock(options, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
