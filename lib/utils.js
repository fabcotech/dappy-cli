const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');
const { dappyNetworks } = require('@fabcotech/dappy-lookup');
const { publicKeyFromPrivateKey } = require('@fabcotech/gossip');
const dotenv = require('dotenv');

const DAPPY_CONFIG_FILE_NAME = 'dappyrc';

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (let i = 0; i < Object.keys(source).length; i += 1) {
      const key = Object.keys(source)[i];
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

// todo
const checkConfigFileForZone = (config) => {
};

const checkConfigFileForDapp = (config) => {
  if (
    typeof config.dapp.html !== 'string'
  ) {
    throw new Error('Did not find config.dapp.html');
  }

  if (
    config.dapp.js
    && typeof config.dapp.js !== 'string'
  ) {
    throw new Error('config.dapp.js should not exist or be a string');
  }

  if (
    config.dapp.css
    && typeof config.dapp.css !== 'string'
  ) {
    throw new Error('config.dapp.css should not exist or be a string');
  }
};

const log = (a, level = 'info') => {
  if (level === 'warning') {
    console.log('\x1b[33m%s\x1b[0m', `${new Date().toISOString()} [WARN] ${a}`);
  } else if (level === 'error') {
    console.log(
      '\x1b[31m%s\x1b[0m',
      `${new Date().toDateString()} [ERROR] ${a}`
    );
  } else {
    console.log(new Date().toISOString(), a);
  }
};
module.exports.log = log;

module.exports.checkConfig = async (recordOrDapp) => {
  dotenv.config({
    path: DAPPY_CONFIG_FILE_NAME
  });

  const configFile = fs.readFileSync('dappy.config.json', 'utf8');

  if (!configFile) {
    throw new Error('No config file');
  }

  let config = {
    options: {
      dappyNetworkId: configFile.dappyNetworkId || 'd',
      dappyNetwork: undefined,
      privateKey: process.env.DAPPY_PRIVATE_KEY
    }
  };
  try {
    config = mergeDeep(config, JSON.parse(configFile));
  } catch (err) {
    throw new Error('Unable to parse config file');
  }

  try {
    config.options.dappyNetwork = JSON.parse(fs.readFileSync(
      path.resolve(
        process.cwd(),
        'dappyNetwork.json'
      ),
      'utf8'
    )).network;
  } catch (err) {
    if (dappyNetworks[config.options.dappyNetworkId]) {
      config.options.dappyNetwork = dappyNetworks[config.options.dappyNetworkId];
    } else {
      throw new Error('Cannot find dappy network ' + config.options.dappyNetworkId)
    }
  }
  config.options.dappyNetwork.forEach((dnm) => {
    if (dnm.caCert) {
      dnm.caCert = Buffer.from(dnm.caCert, 'base64').toString('utf8');
    }
  });

  if (recordOrDapp === 'dapp') {
    checkConfigFileForDapp(config);
  } else if (recordOrDapp === 'zone') {
    checkConfigFileForZone(config);
  }

  let { privateKey } = config.options;
  if (typeof privateKey !== 'string' || (privateKey.length !== 63 && privateKey.length !== 64)) {
    if (typeof privateKey === 'string' && privateKey.length) {
      try {
        privateKey = fs.readFileSync(privateKey, 'utf8');
      } catch (err) {
        throw new Error('Could not read private key from file system');
      }
    } else {
      privateKey = await privateKeyPrompt();
    }
  }

  if (!privateKey) {
    privateKey = process.env.DAPPY_PRIVATE_KEY;
  }

  config.options.publicKey = publicKeyFromPrivateKey(privateKey);

  return {
    privateKey,
    config
  };
};

module.exports.getRecordName = (
  recordName,
  zoneOrigin
) => {
  switch (recordName) {
    case '@':
    case '':
    case undefined:
      return zoneOrigin;
    default:
      return `${recordName}.${zoneOrigin}`;
  }
};

module.exports.getUniqueProcessArgv = (param) => {
  const index = process.argv.findIndex((arg) => arg === param);
  if (index === -1) {
    return false;
  }
  return true;
};

const privateKeyPrompt = () => new Promise((resolve) => {
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!this.muted) process.stdout.write(chunk, encoding);
      callback();
    }
  });

  mutableStdout.muted = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  rl.question('private key: ', (privateKey) => {
    rl.history = rl.history.slice(1);
    resolve(privateKey);
    console.log('');
    rl.close();
  });

  mutableStdout.muted = true;
});
module.exports.privateKeyPrompt = privateKeyPrompt;

module.exports.sanitizeFileName = (a) => a.replace(/[^a-z0-9]/gi, '_').toLowerCase();

const getProcessArgv = (param) => {
  const index = process.argv.findIndex((arg) => arg === param);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};
module.exports.getProcessArgv = getProcessArgv;

module.exports.getHostsFromArgv = (config) => {
  const domainFromArgv = getProcessArgv('--domain');
  let hostFromArgv = getProcessArgv('--hosts');
  if (!hostFromArgv && !domainFromArgv) {
    console.log('Error : please provide either --domain or --hosts');
    process.exit(1);
  }
  if (domainFromArgv) {
    let hostFromArgvWithoutLast = domainFromArgv;
    if (
      domainFromArgv.endsWith('.d')
      || domainFromArgv.endsWith('.gamma')
    ) {
      hostFromArgvWithoutLast = domainFromArgv.split('.').slice(0, domainFromArgv.split('.').length - 1).join('.');
    }
    if (hostFromArgvWithoutLast.includes('.')) {
      console.log('Error : --domain is used for 2nd level domains, not subdomains, it must be in the form example.gamma, example.d or example. Maybe use --hosts instead ?');
      process.exit(1);
    }
    const zone = config.zones.find((z) => z.origin === hostFromArgvWithoutLast);
    if (!zone) {
      console.log('Error : could not find zone for domain ', domainFromArgv);
      process.exit(1);
    } else {
      hostFromArgv = zone.records
        .filter((r) => ['A', 'AAAA'].includes(r.type))
        .map((r) => {
          if (r.name === '@') return `${hostFromArgvWithoutLast}.${config.options.dappyNetworkId}`;
          return `${r.name}.${hostFromArgvWithoutLast}.${config.options.dappyNetworkId}`;
        })
        .filter(onlyUnique)
        .join('+');
      if (hostFromArgv.length === 0) {
        console.log('Error : found zone but no A or AAAA record, cannot generate or apply cert');
        process.exit(1);
      }
    }
  } else if (!hostFromArgv) {
    console.log('Error : please provide either --hosts or --domain parameter');
    process.exit(1);
  }
  return hostFromArgv;
};
