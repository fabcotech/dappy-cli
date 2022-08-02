const fs = require('fs');

const { checkConfig, log } = require('./utils');

module.exports.helloWorldZone = async () => {
  log("Create helloworld zone");

  const { config } = await checkConfig('zone');
  if (!config.zones) config.zones = [];

  if (config.zones.find(z => z.origin.startsWith('helloworld'))) {
    throw new Error('A zone starting with helloworld already exists')
  }

  config.zones = config.zones.concat([
    {
      origin: "helloworld",
      "ttl": 3600,
      "records": [
        {
          "name": "@",
          "type": "A",
          "data": "127.0.0.1"
        },
        {
          "name": "@",
          "type": "CERT",
"data": `LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURCekNDQWUrZ0F3SUJBZ0lVQ2RIanBaUkY0eFBXZW9pT1VZMC9Ma0VCTHM4d0RRWUpLb1pJaHZjTkFRRUwKQlFBd0dqRVlNQllHQTFVRUF3d1BQRVJCVUZCWlgwNUZWRmRQVWtzK01CNFhEVEl5TURjeU9UQTVNelF3TVZvWApEVE13TVRBeE5UQTVNelF3TVZvd0dqRVlNQllHQTFVRUF3d1BQRVJCVUZCWlgwNUZWRmRQVWtzK01JSUJJakFOCkJna3Foa2lHOXcwQkFRRUZBQU9DQVE4QU1JSUJDZ0tDQVFFQXB1WUYvbWxXbGF6MjF1ZlE4UFRSTmlFNDg3UWQKU3lEYmpOVS9BNkUxUEVXenFjNFRuRVdEN1ZrL2ovZGJOZTdVbHFhOGpYbnN5VHdWWFNmTkJ0NDRVbGl6ZURmTgo5MjI0K1pJQUh1OWtSOE9uNktHWE14N294dENZQzI0UXlkZUpZTHdOUDBCWnd1NTJOYm40NVlrWTdWZ3hTZlhxCnVxd3U5M1Zwb0o3YUFjak1jbThYbzNiZDk3SjlpUWZ1TlJnVllYWWppbzJ3SEF2YU8yZEhNL3dJVi9FWVk1SjgKUVJrQ0E1eXhjOUdVT0RzdFZyNXJEalord2k2emg4ckxhQ3AzZjRVWHJVbWZhNXdERHlNMlNQU0grNVpIZUQxeAppbFRaQ1dnRW1aU2pjeVgzTUFHZmdzTjA2UlpuNHQ4WW5YSnFld1E1emJSYU1kMWZtTUhNVlYzaHVRSURBUUFCCm8wVXdRekFpQmdOVkhSRUVHekFaZ2dsc2IyTmhiR2h2YzNTQ0RHaGxiR3h2ZDI5eWJHUXVaREFkQmdOVkhRNEUKRmdRVVQvMzMvUVBJNk9aT0MrQVBaODZtRVVpR0dMQXdEUVlKS29aSWh2Y05BUUVMQlFBRGdnRUJBS0lJbitJdQpzcnBta3BOMlVlb1VkejJUS2RwNngzZ0RBbGtPdVBMc1pReit5MWRyWE5BYlkrYjd0clJNNGV6UHUxaDMyMm5zCmZUeUhValV3MTRNaXRPZ2s3OVJoMjJ2UFdKRWJhV0hMUER2ZVl1U1c3TnZ5TjlBT1MwVW5mV0JKRTNwMDQ0NWQKOE8zNHVsOGtva0hValhsanJCR3YrUFZFV2JVUXN5T3ArdUxaVVZGcTdMeGRISGtkaDE0ZmVFQU42eGRuQ2dVcwpTVmNMT2RaZHRPMjdWbmNMVnVESG5FOHhSMmdRdGszMUF6dXhBZjZ1Uk1wV3NINkdwemUybXV0Q2tlT3NEdG1MCmtGUHh2K3lCQjhhSjlieUJHRTVjN3hpdjZoOFgyQk15cGswUUZHVTdTSEx2TFVMV1hnZlRNSG0vbGNBTXFsQmwKemF1ZXZKZW5JVmY3SUc4PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==`
        }
      ]
    }
  ]);

  fs.writeFileSync(
    'dappy.config.json',
    JSON.stringify(config, null, 2),
    'utf8'
  );

  log("Zone created !");
};
