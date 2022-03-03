const rchainToolkit = require("rchain-toolkit");
const rchainToken = require("rchain-token");

const {
  logDappy,
  checkConfig,
  deployBox,
  log,
} = require("./utils");

module.exports.webconfig = async (nginxOrApache, commands) => {
  const {
    config,
    privateKey,
    publicKey,
  } = await checkConfig('record');

  const host = config.record.id;
  if (typeof host !== "string" || host.length == 0) {
    throw new Error('Need one host at location config.record.id')
  }
  const caCertValue = config.record.values.find(v => v.kind === 'caCert');
  if (!caCertValue) {
    throw new Error(`Need one "caCert" value to print ${nginxOrApache} configuration`)
  }

  const cert = Buffer.from(caCertValue.value, 'base64').toString('utf8');

  if (nginxOrApache === 'nginx') {
    const pathCrt = `/etc/nginx/conf.d/${host}.crt`;
    const pathKey = `/etc/nginx/conf.d/${host}.key`;
    const pathConf = `/etc/nginx/conf.d/${host}.conf`;
    const conf = `server {
  server_name ${host};
  listen 443 ssl;
  root /www/data;
  location / {
  }

  proxy_http_version 1.1;
  proxy_set_header Host $host;

  ssl_protocols TLSv1.2 TLSv1.3;
  # https://nginx.org/en/docs/http/ngx_http_ssl_module.html

  ssl_certificate ${pathCrt};
  ssl_certificate_key ${pathKey};
}`;
  
    if (commands) {
      const commandConf = `echo "${conf}" > ${pathConf}\n`;
      const commandCrt = `echo "${cert || ''}" > ${pathCrt}\n`;
      const commandKey = `echo "${'YOUR CERTIFICATE KEY FILE CONTENT'}" > ${pathKey}`;
      console.log(commandConf)
      console.log(commandCrt)
      console.log(commandKey)
    } else {
      console.log(`############ ${pathConf}`)
      console.log(conf)
      console.log(`############\n\n############${pathCrt}`)
      console.log(cert);
      console.log(`############\n\n############${pathKey}`)
      console.log("YOUR CERTIFICATE KEY FILE\n############")
    }
  } else {
    const pathCrt = `/etc/apache2/sites-enabled/${host}.crt`;
    const pathKey = `/etc/apache2/sites-enabled/${host}.key`;
    const pathConf = `/etc/apache2/sites-enabled/${host}.conf`;
    const conf = `<VirtualHost *:443>
  SSLEngine on
  ServerName ${host}

  LogLevel warn
  SSLCertificateFile ${pathCrt}
  SSLCertificateKeyFile ${pathKey}
  SSLProtocol TLSv1.2
  <IfDefine thisIsAComment>
    Comment https://httpd.apache.org/docs/2.4/en/ssl/ssl_howto.html
  </IfDefine>
  
  DocumentRoot "/www/data"
  
  <Directory "/www/data">
    AuthType None
    Require all granted
  </Directory>
  
</VirtualHost>`;

    if (commands) {
      const commandConf = `echo "${conf}" > ${pathConf}\n`;
      const commandCrt = `echo "${cert || ''}" > ${pathCrt}\n`;
      const commandKey = `echo "${'YOUR CERTIFICATE KEY FILE CONTENT'}" > ${pathKey}`;
      console.log(commandConf)
      console.log(commandCrt)
      console.log(commandKey)
    } else {
      console.log(`############ ${pathConf}`)
      console.log(conf)
      console.log(`############\n\n############${pathCrt}`)
      console.log(cert);
      console.log(`############\n\n############${pathKey}`)
      console.log("YOUR CERTIFICATE KEY FILE\n############")
    }
  }
};
