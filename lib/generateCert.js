const pem = require("pem");
const fs = require("fs");

const {
  checkConfig,
  getProcessArgv,
  getRecordName,
  log,
} = require("./utils");

module.exports.generateCert = async () => {
  const {
    config,
  } = await checkConfig('record');

  let hostFromArgv = getProcessArgv('--host');
  if (!hostFromArgv) {
    throw new Error('Please provide a --host parameter');
  }
  const hostVisual = hostFromArgv;

  if (hostFromArgv.endsWith('.dappy')) {
    hostFromArgv = hostFromArgv.split('.').slice(0, hostFromArgv.split('.').length - 1).join('.')
  }

  if (typeof hostFromArgv !== "string" || hostFromArgv.length == 0) {
    throw new Error('lease provide a --host parameter')
  }

  let lastPart = hostFromArgv.split('.')[hostFromArgv.split('.').length - 1]
  const correctZone = config.zones.find(z => z.origin === lastPart);
  if (!correctZone) {
    throw new Error('zone was not found for host ' + hostVisual)
  }

  const certs = correctZone.records.filter(a => a.type === 'CERT' && getRecordName(a.name, correctZone.origin) === hostFromArgv);

  if (certs.length > 0) {
    console.log('Already ' + certs.length + ' certificates for this host, will generate nother one')
  }

  const days = getProcessArgv('--days') ? parseInt(getProcessArgv('--days'), 10) : 30000;
  console.log('Certificate will be valid for ' + days + ' days')

  let name;
  if (hostFromArgv === correctZone.origin) {
    name = '@'
  } else {
    name = hostFromArgv.split('.').slice(0, hostFromArgv.split('.').length - 1).join('.');
  }

  pem.createCertificate(
    { days: days, selfSigned: true, altNames: [hostFromArgv, hostVisual] },
    function (err, keys) {
      if (err) {
        console.log(err);
        throw new Error('Failed to generate TLS certifcate')
      }
      console.log('Certificate is valid for hosts ' + hostFromArgv + ' and ' + hostVisual);
      console.log('Certificate record added for zone ' + correctZone.origin);
      correctZone.records.push({
        type: 'CERT',
        name: name,
        data: Buffer.from(keys.certificate, 'utf8').toString('base64')
      });

      fs.writeFileSync(
        __dirname + '/dappy.config.json',
        JSON.stringify(
          config,
          null,
          2
        ),
        'utf8'
      )
      console.log(hostVisual + '.crt :\n');
      console.log(keys.certificate);
      console.log('\n')
      console.log(hostVisual + '.key :\n');
      console.log(keys.clientKey);
    }
  );
};
