const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { blake2b } = require('blakejs');
const { Writable } = require('stream');
const elliptic = require('elliptic');
const rchainToolkit = require('@fabcotech/rchain-toolkit');
const { dappyNetworks } = require('@fabcotech/dappy-lookup');
const rchainToken = require('@fabcotech/rchain-token');
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
const checkConfigFileForZone= (config) => {
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

const ec = new elliptic.ec('secp256k1');

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
      console.log('Using dappy network ' + config.options.dappyNetworkId)
      config.options.dappyNetwork = dappyNetworks[config.options.dappyNetworkId];
    } else {
      throw new Error('Cannot find dappy network ' + config.options.dappyNetworkId)
    }
  }
  // Eventually turn base64 into utf8
  config.options.dappyNetwork.forEach((dnm) => {
    if (dnm.caCert.endsWith('==')) {
      dnm.caCert = Buffer.from(dnm.caCert, 'base64').toString('utf8')
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

module.exports.createHtmlWithTags = (config) => {
  let js;
  if (config.dapp.js) {
    try {
      js = fs.readFileSync(config.dapp.js, 'utf8');
    } catch (err) {
      throw new Error(`Could not read config.dapp.js file ${config.dapp.js}`);
    }
  }
  let css;
  if (config.dapp.css) {
    try {
      css = fs.readFileSync(config.dapp.css, 'utf8');
    } catch (err) {
      throw new Error(`Could not read config.dapp.css file ${config.dapp.css}`);
    }
  }

  try {
    html = fs.readFileSync(config.dapp.html, 'utf8');
  } catch (err) {
    throw new Error(`Could not read config.dapp.html file ${config.dapp.html}`);
  }

  let headClosesIndex = html.indexOf('</head>');
  if (headClosesIndex === -1) {
    throw new Error('The html document has no closing </head> tag');
  }

  let cssTag;
  if (css) {
    cssTag = `<style>${css}</style>`;
    const half1 = html.substr(0, headClosesIndex);
    const half2 = html.substr(headClosesIndex);
    html = half1 + cssTag + half2;
  }

  headClosesIndex = html.indexOf('</head>');
  let jsTag;
  if (js) {
    jsTag = `<script type="text/javascript">${js}</script>`;
    const half1 = html.substr(0, headClosesIndex);
    const half2 = html.substr(headClosesIndex);
    html = half1 + jsTag + half2;
  }

  return html;
};

module.exports.getProcessArgv = (param) => {
  const index = process.argv.findIndex((arg) => arg === param);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

module.exports.deployBox = async (httpUrlValidator, shardId, privateKey, publicKey, masterRegistryUri, boxId) => {
  const term2 = rchainToken.deployBoxTerm({
    publicKey,
    revAddress: rchainToolkit.utils.revAddressFromPublicKey(publicKey),
    boxId,
    masterRegistryUri
  });

  let dataAtNameResponse2;
  try {
    dataAtNameResponse2 = await rchainToolkit.http.easyDeploy(
      httpUrlValidator,
      {
        term: term2,
        privateKey: privateKey,
        shardId: shardId,
        phloPrice: 1,
        phloLimit: 10000000,
        timeout: 8 * 60 * 1000
      }
    );
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }

  const data2 = rchainToolkit.utils.rhoValToJs(
    JSON.parse(dataAtNameResponse2).exprs[0].expr
  );

  if (data2.status !== 'completed') {
    throw new Error(data2);
  }

  return data2.boxId;
};

module.exports.getBlake2Hash = (a, length) => blake2b(a, 0, length);

module.exports.createFile = (data, mimeType, name, signature) => JSON.stringify({
  mimeType,
  name,
  data,
  signature
});

// Careful, it is different than the function that build
// the unforgeable query for dappy-node
module.exports.buildUnforgeableNameQuery = (unforgeableName) => ({
  UnforgPrivate: { data: unforgeableName }
});

module.exports.createSignature = (data, mimeType, name, privateKey) => {
  const toSign = new Uint8Array(
    Buffer.from(
      JSON.stringify({
        mimeType,
        name,
        data
      })
    )
  );
  const blake2Hash64 = module.exports.getBlake2Hash(toSign, 64);
  const keyPair = ec.keyFromPrivate(privateKey);
  const signature = keyPair.sign(blake2Hash64, { canonical: true });
  const signatureHex = Buffer.from(signature.toDER()).toString('hex');
  if (
    !ec.verify(
      blake2Hash64,
      signature,
      keyPair.getPublic().encode('hex'),
      'hex'
    )
  ) {
    throw new Error('dpy signature verification failed');
  }

  return signatureHex;
};

module.exports.createBase64 = (htmlWithTags) => Buffer.from(htmlWithTags).toString('base64');

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

module.exports.getProcessArgv = (param) => {
  const index = process.argv.findIndex((arg) => arg === param);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};
