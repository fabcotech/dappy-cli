const https = require('https');
const { signZoneTransaction } = require('@fabcotech/gossip');

const checkZone = require('./check').checkZone;
const { checkConfig, log } = require('./utils');

async function addZone(
  zone,
  options
) {
  const {
    privateKey,
    dappyNetwork
  } = options;

   await new Promise((resolve, reject) => {
    const dnm = dappyNetwork[0];
    const options = {
      minVersion: 'TLSv1.3',
      rejectUnauthorized: true,
      ca: dnm.caCert,
      host: dnm.ip,
      method: 'POST',
      port: dnm.port,
      path: `/gossip`,
      headers: {
        'Content-Type': 'application/json',
        Host: dnm.hostname,
      },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject('Status code not 200');
        return;
      }
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });
    req.on('error', err => {
      reject(err)
    });

    const data = {
      zone: zone,
      date: new Date().getTime()
    };
    const signature = signZoneTransaction(
      data,
      privateKey,
      'hex'
    );
    req.end(JSON.stringify(
      {
        data: data,
        signature: signature
      }
    ));
  });
}

module.exports.pushZones = async () => {
  const { config } = await checkConfig('zone');

  let performPushes = [];

  const push = async () => {
    log(`Dappy network   :  ${config.options.dappyNetworkId}`);
    log(`Public key      :  ${config.options.publicKey}`);

    let deployeds = []
    for (let i = 0; i < performPushes.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      deployeds.push(
        await addZone(
          config.zones.find(z => z.origin === performPushes[i][1]),
          config.options
        )
      );
      if (deployeds.length === performPushes.length) {
        log('Purchases and updates were deployed, now do dappy-cli check to verify the state of your domains')
      }
    }
  };

  const checks = [];
  for (let i = 0; i < config.zones.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const c = await checkZone(config.zones[i], config.options);
    checks.push(c)
    if (checks.length === config.zones.length) {
      performPushes = checks.filter(c => ['notexists', 'notmatches'].includes(c[0]));
      const errors = checks.filter(c => ['belongsotherowner', 'invalidnoowner'].includes(c[0]));
      const oks = checks.filter(c => ['ok'].includes(c[0]));
      oks.forEach(c => {
        console.log('\x1b[32m' + `✓ ${c[1].padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
      });
      errors.forEach(e => {
        console.log('\x1b[31m' + `⨯ ${c[1].padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
      });
      if (performPushes.length > 0) {
        console.log('Will process the following zones         : \x1b[36m' + performPushes.map(p => p[1]).join(', ') + '\x1b[0m');
        push();
      } else {
        console.log('No zone to process, everything is up to date')
      }
    }
  }
};
