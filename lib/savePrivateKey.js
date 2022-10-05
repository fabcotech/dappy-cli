const fs = require('fs');
const path = require('path');

const { getProcessArgv } = require('./utils');

module.exports.savePrivateKey = async () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'dappy.config.json'), 'utf8')
  );
  if (config.options.privateKey) {
    throw new Error('Config already has a .options.privateKey');
  }

  const privateKey = getProcessArgv('--private-key');
  if (!privateKey) {
    throw new Error('Unknown --private-key parameter');
  }
  config.options.privateKey = privateKey;
  fs.writeFileSync(
    path.resolve(process.cwd(), 'dappy.config.json'),
    JSON.stringify(config, null, 2),
    'utf8'
  );
  console.log('dappy.config.json updated !');
};
