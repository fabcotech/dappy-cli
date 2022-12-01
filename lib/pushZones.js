const http = require('http');
const https = require('https');
const { signZoneTransaction } = require('@fabcotech/gossip');

const { checkZone } = require('./check');
const { checkConfig, log } = require('./utils');

function addZone(zone, params) {
  const { privateKey, dappyNetwork } = params;

  return new Promise((resolve, reject) => {
    const dnm = dappyNetwork[0];
    const options = {
      minVersion: 'TLSv1.3',
      rejectUnauthorized: true,
      ca: dnm.caCert,
      host: dnm.ip,
      method: 'POST',
      port: dnm.port,
      path: '/gossip',
      headers: {
        'Content-Type': 'application/json',
        Host: dnm.hostname
      }
    };
    const httpModule = dnm.scheme === 'http' ? http : https;
    const req = httpModule.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Status code not 200'));
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
    req.on('error', (err) => {
      reject(err);
    });

    let data = {
      zone,
      date: new Date().toISOString()
    };

    if (process.env.NEW_ZONE === 'true') {
      data = {
        zone,
        date: new Date().toISOString(),
        new: true
      };
    }

    const signature = signZoneTransaction(data, privateKey, 'hex');
    req.end(
      JSON.stringify({
        data,
        signature
      })
    );
  });
}

module.exports.pushZones = async () => {
  const { config } = await checkConfig('zone');

  let performPushes = [];

  // eslint-disable-next-line no-underscore-dangle
  const _pushZones = async () => {
    log(`Dappy network   :  ${config.options.dappyNetworkId}`);
    log(`Public key      :  ${config.options.publicKey}`);

    await Promise.all(
      performPushes.map((zone) => addZone(
        config.zones.find((z) => z.origin === zone[1]),
        config.options
      ))
    );

    log(
      'Purchases and updates were deployed, now do dappy-cli check to verify the state of your domains'
    );
  };

  const checks = [];
  for (let i = 0; i < config.zones.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const c = await checkZone(config.zones[i], config.options);
    checks.push(c);
    if (checks.length === config.zones.length) {
      performPushes = checks.filter((ch) => ['notexists', 'notmatches'].includes(ch[0]));
      const errors = checks.filter((ch) => ['belongsotherowner', 'invalidnoowner'].includes(ch[0]));
      const oks = checks.filter((ch) => ['ok'].includes(ch[0]));
      oks.forEach((ch) => {
        console.log(
          `\x1b[32m ✓ ${ch[1].padEnd(17, ' ')}\x1b[0m' : ${ch[2]}`
        );
      });
      errors.forEach((er) => {
        console.log(
          `\x1b[31m ⨯ ${er[1].padEnd(17, ' ')}\x1b[0m : ${er[2]}`
        );
      });
      if (performPushes.length > 0) {
        console.log(
          `Will process the following zones         : \x1b[36m${performPushes.map((p) => p[1]).join(', ')}\x1b[0m`
        );
        await _pushZones();
      } else {
        console.log('No zone to process, everything is up to date');
      }
    }
  }
};
