const https = require('https');
const fs = require('fs');

const { log, getProcessArgv } = require('./utils');

module.exports.helloWorldServer = async () => {
  let key = '';
  try {
    const keyPath = getProcessArgv('--key');
    key = fs.readFileSync(
      keyPath,
      'utf8'
    )
    if (!key.length) {
      throw 'length 0'
    }
  } catch (err) {
    console.log('unable to read key file, please provide --key argument');
    process.exit();
  }

  let cert = '';
  try {
    const certPath = getProcessArgv('--cert');
    cert = fs.readFileSync(
      certPath,
      'utf8'
    )
    if (!cert.length) {
      throw 'length 0'
    }
  } catch (err) {
    console.log('unable to read cert file, please provide --cert argument');
    process.exit();
  }

  const options = {
    key,
    cert,
    minVersion: 'TLSv1.3',
    cipher: 'TLS_AES_256_GCM_SHA384',
  };
  https.createServer(
    options,
    (req, res) => {
      console.log(req.url);
      res.writeHead(200);
      res.end("<html><body style='background:#fff;display:flex;justify-content:center;align-items:center;font-size:3rem;'>Hello world !</body></html>")
    }
  ).listen(3008);

  console.log("(helloworld) listenning on 127.0.0.1:3008")
};
