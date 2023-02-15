const fs = require('fs');
const path = require('path');

const pad = (str, length) => {
  let s = str;
  for (let i = 0; i < length - str.length; i += 1) {
    s += ' ';
  }
  return s;
};

const paragraph = (s) => {
  const lineMaxLen = 50;
  const wsLookup = 15; // Look backwards n characters for a whitespace
  const regex = new RegExp(String.raw`\s*(?:(\S{${lineMaxLen}})|([\s\S]{${lineMaxLen - wsLookup},${lineMaxLen}})(?!\S))`, 'g');
  return s.replace(regex, (_, x, y) => (x ? `${x}-\n` : `${y}\n`));
};

module.exports.help = () => {
  let s = '';

  const helps = [
    ['--help', 'displays examples and help for each command'],
    ['init', 'will create an empty dappy.config.json in working dir'],
    ['check', 'checks if each zone matches the zone on the blockchain'],
    ['tree', 'prints in a tree-based way the domains, subdomains and associated records (CERT, TXT, A, AAAA)'],
    ['pushzones', 'will sign and push transaction for each zone that does not match blockchain'],
    ['generateprivatekey', 'generates a new private key that is either printed, or saved in dappy.config.json'],
    ['saveprivatekey', 'saves private key to dappy.config.json', 'ex: saveprivatekey --private-key abcdefg'],
    ['printpublickey', 'prints public key that corresponds to private key in dappy.config.json'],
    ['generatecerts', 'generates TLS certificates for all hosts under a domain, or specific hosts', 'ex: generatecerts --domain mydomain.d', 'ex: generatecerts --hosts mydomain.d foo.mydomain.d'],
    ['apply', 'stores .crt file in dappy.config.json file for all hosts under a domain, or specific hosts', 'ex: apply --cert group1.crt --domain mydomain.d', 'ex: apply --cert group1.crt --hosts mydomain.d foo.mydomain.d']
  ];
  helps.forEach((h) => {
    const a = ` ${pad(h[0], 24)}`;
    s += a;
    const desc = paragraph(h[1]).split('\n').map((s, i) => {
      if (i === 0) return s;
      let ss = s;
      for (let j = 0; j < a.length; j += 1) {
        ss = ` ${ss}`;
      }
      return ss;
    }).join('\n');
    s += desc;

    if (h[2]) {
      s += '\n';
      for (let i = 0; i < a.length; i += 1) {
        s += ' ';
      }
      s += h[2];
    }
    if (h[3]) {
      s += '\n';
      for (let i = 0; i < a.length; i += 1) {
        s += ' ';
      }
      s += h[3];
    }
    s += '\n';
  });

  console.log(s);
};
