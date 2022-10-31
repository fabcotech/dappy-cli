const fs = require("fs");
const path = require('path');
const { exec } = require("child_process");

const {
  checkConfig,
  getHostsFromArgv
} = require('./utils');

module.exports.generateCert = async () => {
  const {
    config
  } = await checkConfig('record');

  const hostFromArgv = getHostsFromArgv(config);
  const groups = hostFromArgv.split(',');

  const generateCertsWithOpenSsl = async () => {
    let i = 0;
    const generate = async () => {
      const hosts = groups[i].split('+');
      const random = `tmp${Math.round(Math.random() * 100000)}.config`;
      fs.writeFileSync(
        path.resolve(process.cwd(), random),
        `[req]
distinguished_name=req
[san]
subjectAltName=${hosts.map((h, ind) => `DNS.${ind + 1}:${h}`).join(',')}`, 'utf8'
      );

      const cmd = `openssl req \
      -x509 \
      -newkey rsa:2048 \
      -sha256 \
      -days 3000 \
      -nodes \
      -keyout group${i + 1}.key \
      -out group${i + 1}.crt \
      -outform PEM \
      -subj '/CN=${hosts[0]}' \
      -extensions san \
      -config ${path.resolve(process.cwd(), random)}`;

      exec(
        cmd,
        { maxBuffer: 1024 * 1000 },
        (error, stdout, stderr) => {
          if (error) {
            console.log(error);
            console.log(stderr);
            throw new Error('Error openssl req command');
          }
          fs.rmSync(random);
          console.log(`== hosts ${hosts.join(', ')}`);
          console.log(`group${i + 1}.key created`);
          console.log(`group${i + 1}.crt created\n`);
          i += 1;
          if (groups[i]) {
            generate();
          }
        }
      );
    };
    await generate();
  };

  exec(
    'openssl version',
    { maxBuffer: 1024 * 1000 },
    (error, stdout, stderr) => {
      if (error) {
        console.log(error);
        console.log(stderr);
        console.log('Error, is openssl installed on your system ?');
        process.exit(1);
      }
      generateCertsWithOpenSsl();
    }
  );
};
