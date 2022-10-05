const http = require('http');
const https = require('https');
const isEqual = require('lodash.isequal');
const { checkConfig, getProcessArgv } = require('./utils');

async function checkZone(zone, { dappyNetwork, publicKey }) {
  const results = await new Promise((resolve, reject) => {
    const dnm = dappyNetwork[0];
    const options = {
      minVersion: 'TLSv1.3',
      rejectUnauthorized: true,
      ca: dnm.caCert,
      host: dnm.ip,
      method: 'POST',
      port: dnm.port,
      path: '/get-zones',
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
    req.end(JSON.stringify([zone.origin]));
  });

  const ownerTxt = (zone.records || []).find(
    (r) => r.type === 'TXT' && r.data.startsWith('OWNER=')
  );
  if (!ownerTxt) {
    return ['invalidnoowner', zone.origin, 'local zone is invalid, no owner'];
  }

  const zoneOnChain = JSON.parse(results).result.find(
    (d) => d.origin === zone.origin
  );
  if (!zoneOnChain) {
    return ['notexists', zone.origin, 'domain does not exist'];
  }
  const ownerTxt2 = (zoneOnChain.records || []).find(
    (r) => r.type === 'TXT' && r.data.startsWith('OWNER=')
  );
  if (!ownerTxt2) {
    return ['notexists', zone.origin, 'does not exist (yet ?)'];
  }
  const publicKeyOfZone = ownerTxt2.data.slice(6);
  if (publicKeyOfZone !== publicKey) {
    return [
      'belongsotherowner',
      zone.origin,
      `domain belongs to another identity than ${publicKey}`
    ];
  }

  if (isEqual(zoneOnChain, zone)) {
    return ['ok', zone.origin, 'domain is owned, and zone up to date'];
  }
  return [
    'notmatches',
    zone.origin,
    'domain is owned, but zone is not up to date, either wait or update'
  ];
}

module.exports.checkZone = checkZone;

module.exports.check = async () => {
  const { config } = await checkConfig('zone');
  const networkId = config.options.dappyNetworkId;
  const check = async () => {
    // ===================
    // Check NFT contract and purse
    // ===================
    if (!config.zones || Object.keys(config.zones).length === 0) {
      throw new Error(
        'No zone to deploy, cannot find config.zone, or zero zones'
      );
    }

    let failEventually = false;
    const checks = [];
    for (let i = 0; i < config.zones.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ch = await checkZone(config.zones[i], config.options);
      checks.push(ch);
      if (checks.length === config.zones.length) {
        if (checks.find((c) => c[0] === 'invalidnoowner')) {
          console.log(`You have at least one zone in your dappy.config.json file that does not have an owner record. Make sure every zone as at least a TXT record with the following structure :\n
{ "name": "@", "type": "TXT", "data": "OWNER=0433xxxxx" }\n`);
        }
        if (failEventually === false) {
          failEventually = !!checks.find((c) => c[0] !== 'ok');
        }
        checks.forEach((c) => {
          if (c[0] === 'ok') {
            console.log(
              `\x1b[32m✓ ${`${c[1]}.${networkId}`.padEnd(17, ' ')}\x1b[0m : ${
                c[2]
              }`
            );
          } else if (c[0] === 'invalidnoowner') {
            console.log(
              `\x1b[31m⨯ ${`c[1].${networkId}`.padEnd(17, ' ')}\x1b[0m : ${
                c[2]
              }`
            );
          } else if (c[0] === 'notexists') {
            console.log(
              `\x1b[31m⨯ ${`${c[1]}.${networkId}`.padEnd(17, ' ')}\x1b[0m : ${
                c[2]
              }`
            );
          } else if (c[0] === 'notmatches') {
            console.log(
              `\x1b[31m⨯ ${`${c[1]}.${networkId}`.padEnd(17, ' ')}\x1b[0m : ${
                c[2]
              }`
            );
          } else if (c[0] === 'belongsotherowner') {
            console.log(
              `\x1b[31m⨯ ${`${c[1]}.${networkId}`.padEnd(17, ' ')}\x1b[0m : ${
                c[2]
              }`
            );
          } else {
            throw new Error('Unknown status');
          }
        });
      }
    }

    if (failEventually && getProcessArgv('--fail-eventually')) {
      console.error(
        'One zone is either belongsotherowner / notmatches / notexists / invalidnoowner'
      );
      process.exit(1);
    }
  };

  check();
};
