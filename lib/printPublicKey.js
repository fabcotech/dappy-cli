const fs = require('fs');

const { publicKeyFromPrivateKey } = require('@fabcotech/gossip');

module.exports.printPublicKey = async () => {
  const configFile = fs.readFileSync('dappy.config.json', 'utf8');
  const config = JSON.parse(configFile)
  if (!config.options.privateKey || !config.options.privateKey.length) {
    console.log('Private key not found in dappy.config.json, cannot print public key');
  } else {
    console.log('Public key :\n' + publicKeyFromPrivateKey(config.options.privateKey))
    console.log('\nTXT owner record :\n' + `{ "name": "@", "type": "TXT", "data": "OWNER=${publicKeyFromPrivateKey(config.options.privateKey)}" }`)
  }

};
