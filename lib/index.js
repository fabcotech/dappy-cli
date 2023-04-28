#!/usr/bin/env node

const { init } = require('./init');
const { help } = require('./help');
const { pushZones } = require('./pushZones');
const { webconfig } = require('./webconfig');
const { generateCert } = require('./generateCert');
const { apply } = require('./apply');
const { tree } = require('./tree');
const { generatePrivateKey } = require('./generatePrivateKey');
const { savePrivateKey } = require('./savePrivateKey');
const { printPublicKey } = require('./printPublicKey');
const { check } = require('./check');
const { helloWorldServer } = require('./helloWorldServer');

function argvInclude(cmd) {
  return process.argv.includes(cmd);
}

async function run() {
  const commands = [
    [argvInclude('--help'), help],
    [argvInclude('-h'), help],
    [argvInclude('init'), init],
    [argvInclude('pushzones'), pushZones],
    [argvInclude('push'), pushZones],
    [argvInclude('saveprivatekey'), savePrivateKey],
    [argvInclude('generateprivatekey'), generatePrivateKey],
    [argvInclude('printpublickey'), printPublicKey],
    [argvInclude('generatecerts'), generateCert],
    [argvInclude('apply'), apply],
    [argvInclude('tree'), tree],
    [
      argvInclude('nginx'),
      () => webconfig('nginx', process.argv.includes('--commands'))
    ],
    [
      argvInclude('apache'),
      () => webconfig('apache', process.argv.includes('--commands'))
    ],
    [argvInclude('helloworldserver'), helloWorldServer],
    [argvInclude('check'), check],
    [argvInclude('status'), check]
  ];

  const command = commands.find(([cond]) => cond);
  if (!command) {
    throw new Error('Unrecognized command');
  }
  const [, execCommand] = command;
  await execCommand();
}

run();
