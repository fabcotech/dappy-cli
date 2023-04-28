const { checkConfig } = require('./utils');

const pad = (str, length) => {
  let s = str;
  for (let i = 0; i < length; i += 1) {
    s = ` ${s}`;
  }
  return s;
};

module.exports.tree = async () => {
  const {
    config
  } = await checkConfig('record');
  config.zones.forEach((zone) => {
    const tld = `${zone.origin}.${config.options.dappyNetworkId}`;
    const logAtOrSubdomain = (r) => {
      if (r.name === '@') {
        console.log(pad(`\x1b[44m\x1b[37m${r.name}\x1b[0m`, 2));
      } else {
        console.log(pad(`\x1b[44m\x1b[37m${r.name}\x1b[0m.${tld}`, 2));
      }
    };
    console.log(pad(`\x1b[44m\x1b[37m${tld}\x1b[0m`, 2));

    const subdomainsHandled = [];
    zone.records.forEach((r) => {
      if (['CNAME', 'A', 'AAAA', 'CERT', 'TXT'].includes(r.type)) {
        if (subdomainsHandled.find((s) => s === r.name)) return;
        subdomainsHandled.push(r.name);
        logAtOrSubdomain(r);

        const aRecord = zone.records.find((rr) => rr.type === 'A' && rr.name === r.name);
        if (aRecord) {
          console.log(pad(`A    ${aRecord.data}`, 4));
        }

        const aaaaRecord = zone.records.find((rr) => rr.type === 'AAAA' && rr.name === r.name);
        if (aaaaRecord) {
          console.log(pad(`AAAA ${aaaaRecord.data}`, 4));
        }

        const cert = zone.records.find((rr) => rr.type === 'CERT');
        if (cert) {
          const utf8 = Buffer.from(cert.data, 'base64').toString('utf8');
          console.log(pad(`CERT ${utf8.replace(/\n/g, '').slice(0, 50)}…`, 4));
        }

        const cname = zone.records.find((rr) => rr.type === 'CNAME');
        if (cname) {
          console.log(pad(`CNAME ${cname.data}`, 4));
        }

        const txtRecords = zone.records.filter((rr) => rr.type === 'TXT' && rr.name === r.name);
        if (txtRecords) {
          txtRecords.forEach((txt) => {
            console.log(pad(`TXT  ${txt.data.slice(0, 50)}…`, 4));
          });
        }
      }
    });
    console.log('\n');
  });
};
