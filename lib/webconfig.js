const {
  checkConfig,
  getRecordName,
  getProcessArgv,
} = require('./utils');

module.exports.webconfig = async (nginxOrApache, commands) => {
  const {
    config
  } = await checkConfig('zone');

  let hostFromArgv = getProcessArgv('--host');
  if (!hostFromArgv) {
    throw new Error('Please provide a --host parameter')
  }
  const hostVisual = hostFromArgv;

  if (hostFromArgv.endsWith('.dappy')) {
    hostFromArgv = hostFromArgv.split('.').slice(0, hostFromArgv.split('.').length - 1).join('.')
  }

  let lastPart = hostFromArgv.split('.')[hostFromArgv.split('.').length - 1]
  const correctZone = config.zones.find(z => z.origin === lastPart);
  if (!correctZone) {
    throw new Error('zone was not found for host ' + hostVisual)
  }

  const certs = correctZone.records.filter(a => a.type === 'CERT' && getRecordName(a.name, correctZone.origin) === hostFromArgv);

  if (certs.length === 0) {
    throw new Error('Did not find CERT record for host ' + hostVisual)
  }
  if (certs.length > 1) {
    console.log('Found ' + certs.length + ' CERT records for host ' + hostVisual + ', will pick first one')
  }

  const cert = Buffer.from(certs[0].data, 'base64').toString('utf8');

  if (nginxOrApache === 'nginx') {
    const pathCrt = `/etc/nginx/conf.d/${hostVisual}.crt`;
    const pathKey = `/etc/nginx/conf.d/${hostVisual}.key`;
    const pathConf = `/etc/nginx/conf.d/${hostVisual}.conf`;
    const conf = `server {
  server_name ${hostVisual};
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
    const pathCrt = `/etc/apache2/sites-enabled/${hostVisual}.crt`;
    const pathKey = `/etc/apache2/sites-enabled/${hostVisual}.key`;
    const pathConf = `/etc/apache2/sites-enabled/${hostVisual}.conf`;
    const conf = `<VirtualHost *:443>
  SSLEngine on
  ServerName ${hostVisual}

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
      console.log(`############ ${pathConf}`);
      console.log(conf);
      console.log(`############\n\n############${pathCrt}`);
      console.log(cert);
      console.log(`############\n\n############${pathKey}`);
      console.log('YOUR CERTIFICATE KEY FILE\n############');
    }
  }
};
