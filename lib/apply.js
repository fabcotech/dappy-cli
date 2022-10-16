const fs = require("fs");
const path = require('path');
const { exec } = require("child_process");

const {
  checkConfig,
  getProcessArgv,
  getHostsFromArgv
} = require('./utils');

module.exports.apply = async () => {
  const {
    config
  } = await checkConfig('record');

  const certFromArgv = getProcessArgv('--cert');
  if (certFromArgv) {
    let cert = '';
    try {
      cert = fs.readFileSync(path.resolve(process.cwd(), certFromArgv), 'utf8');
    } catch (err) {
      console.log('Error : could not read cert ', certFromArgv);
      process.exit(1);
    }

    const hostFromArgv = getHostsFromArgv(config);
    const hosts = hostFromArgv.split('+').map((h) => {
      if (
        h.endsWith('.d')
        || h.endsWith('.gamma')
      ) {
        return h.split('.').slice(0, h.split('.').length - 1).join('.');
      }
      return h;
    });
    cert = Buffer.from(cert, 'utf8').toString('base64');

    hosts.forEach((host) => {
      let recordName = '@';
      let zoneOrigin = host;
      if (host !== host.split('.')[host.split('.').length - 1]) {
        recordName = host.split('.').slice(0, host.split('.').length - 1).join('.');
        zoneOrigin = host.split('.')[host.split('.').length - 1];
      }
      const z = config.zones.find((z) => z.origin === zoneOrigin);
      if (!z) {
        console.log(`Error : zone ${zoneOrigin} not found`);
        process.exit(1);
      }
      const existingCert = z.records.find((r) => r.type === 'CERT' && r.name === recordName);
      if (existingCert) {
        console.log(`Error : zone ${zoneOrigin} already has a CERT record for ${recordName}`);
        process.exit(1);
      }
      z.records = z.records.concat({ type: 'CERT', name: recordName, data: cert });
    });

    hosts.forEach((h) => {
      console.log(`== host ${h}`);
      console.log('New record CERT created and saved');
    });

    delete config.options.dappyNetwork;
    delete config.options.publicKey;
    fs.writeFileSync(
      path.resolve(process.cwd(), 'dappy.config.json'),
      JSON.stringify(
        config,
        null,
        2
      ),
      'utf8'
    );
  } else {
    console.log('Unrecognized command, need --cert');
    process.exit(1);
  }
};
