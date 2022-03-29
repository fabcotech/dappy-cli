const {
  checkConfig
} = require('./utils');

module.exports.webconfig = async (nginxOrApache, commands) => {
  const {
    config
  } = await checkConfig('zone');

  const host = config.zones[0].origin;
  if (typeof host !== 'string' || host.length === 0) {
    throw new Error('Need one host at location  config.zones[0].origin');
  }
  const caCertValue = config.zones[0].records.find((v) => v.type === 'CERT');
  if (!caCertValue) {
    throw new Error(`Need one "CERT" data to print ${nginxOrApache} configuration`);
  }

  const cert = Buffer.from(caCertValue.data, 'base64').toString('utf8');

  if (nginxOrApache === 'nginx') {
    const pathCrt = `/etc/nginx/conf.d/${hostFromArgv}.crt`;
    const pathKey = `/etc/nginx/conf.d/${hostFromArgv}.key`;
    const pathConf = `/etc/nginx/conf.d/${hostFromArgv}.conf`;
    const conf = `server {
  server_name ${hostFromArgv};
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
      console.log(commandConf);
      console.log(commandCrt);
      console.log(commandKey);
    } else {
      console.log(`############ ${pathConf}`);
      console.log(conf);
      console.log(`############\n\n############${pathCrt}`);
      console.log(cert);
      console.log(`############\n\n############${pathKey}`);
      console.log('YOUR CERTIFICATE KEY FILE\n############');
    }
  } else {
    const pathCrt = `/etc/apache2/sites-enabled/${hostFromArgv}.crt`;
    const pathKey = `/etc/apache2/sites-enabled/${hostFromArgv}.key`;
    const pathConf = `/etc/apache2/sites-enabled/${hostFromArgv}.conf`;
    const conf = `<VirtualHost *:443>
  SSLEngine on
  ServerName ${hostFromArgv}

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
      const commandCrt = `echo "${caCertValue || ''}" > ${pathCrt}\n`;
      const commandKey = `echo "${'YOUR CERTIFICATE KEY FILE CONTENT'}" > ${pathKey}`;
      console.log(commandConf);
      console.log(commandCrt);
      console.log(commandKey);
    } else {
<<<<<<< HEAD
      console.log(`############ ${pathConf}`);
      console.log(conf);
      console.log(`############\n\n############${pathCrt}`);
      console.log(cert);
      console.log(`############\n\n############${pathKey}`);
      console.log('YOUR CERTIFICATE KEY FILE\n############');
=======
      console.log(`############ ${pathConf}`)
      console.log(conf)
      console.log(`############\n\n############${pathCrt}`)
      console.log(caCertValue);
      console.log(`############\n\n############${pathKey}`)
      console.log("YOUR CERTIFICATE KEY FILE\n############")
>>>>>>> 6c6d068 (updated nginx/apache and also new script generatecert)
    }
  }
};
