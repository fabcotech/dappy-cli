const fs = require('fs');
const path = require('path');
const elliptic = require('elliptic');
const readline = require('readline');
const { Writable } = require('stream');

const { publicKeyFromPrivateKey } = require('@fabcotech/gossip');

module.exports.generatePrivateKey = async () => {
  const ec = new elliptic.ec('secp256k1');
  const key = ec.genKeyPair();
  const privateKey = key.getPrivate().toString(16);

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!this.muted) process.stdout.write(chunk, encoding);
      callback();
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  rl.question(
    'Do you prefer that we\n(1) print private and public key on screen\n(2) update your dappy.config.json file with the private key\nPlease choose 1 or 2 :',
    (resp) => {
      if (resp === '1') {
        console.log(`\nPrivate key :\n${privateKey}`);
        console.log(`Public key  :\n${publicKeyFromPrivateKey(privateKey)}`);
      } else if (resp === '2') {
        try {
          const configFile = fs.readFileSync(
            path.resolve(process.cwd(), 'dappy.config.json'),
            'utf8'
          );
          const config = JSON.parse(configFile);
          if (config.options.privateKey && config.options.privateKey.length) {
            console.log(
              'A private key already exists in options.config, please remove it'
            );
          } else {
            config.options.privateKey = privateKey;
            fs.writeFileSync(
              path.resolve(process.cwd(), 'dappy.config.json'),
              JSON.stringify(config, null, 2),
              'utf8'
            );
            console.log('dappy.config.json updated !');
          }
        } catch (err) {
          console.log(err);
          console.log('Error');
        }
      } else {
        console.log('Unknown response');
      }
      rl.close();
    }
  );
};
