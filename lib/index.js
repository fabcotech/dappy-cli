#!/usr/bin/env node

const { init } = require('./init');
const { pushDapp } = require('./pushDapp');
const { pushZones } = require('./pushZones');
const { webconfig } = require('./webconfig');
const { generateCert } = require('./generateCert');
const { generatePrivateKey } = require('./generatePrivateKey');
const { printPublicKey } = require('./printPublicKey');
const { check } = require('./check');
const { helloWorldServer } = require('./helloWorldServer');

function argvInclude(cmd) {
  return process.argv.includes(cmd);
}

async function run() {
  const commands = [
    [argvInclude('init'), init],
    [argvInclude('pushdapp'), pushDapp],
    [argvInclude('pushzones'), pushZones],
    [argvInclude('generateprivatekey'), generatePrivateKey],
    [argvInclude('printpublickey'), printPublicKey],
    [argvInclude('generateselfsignedcert'), generateCert],
    [argvInclude('nginx'), () => webconfig('nginx', process.argv.includes('--commands'))],
    [argvInclude('apache'), () => webconfig('apache', process.argv.includes('--commands'))],
    [argvInclude('helloworldserver'), helloWorldServer],
    [argvInclude('check'), check]
  ];

  const command = commands.find(([cond]) => cond);
  if (!command) {
    throw new Error('Unrecognized command');
  }
  const [, execCommand] = command;
  await execCommand();
}

run();
