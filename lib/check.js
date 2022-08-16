const fs = require('fs');
const rchainToolkit = require('@fabcotech/rchain-toolkit');
const rchainToken = require('@fabcotech/rchain-token');

const { checkConfig, log } = require('./utils');

async function checkZone(
  zone,
  {
    masterRegistryUri,
    nameSystemContractId,
    readOnly,
    boxId
  }
) {
  const data = Buffer.from(JSON.stringify(zone), 'utf8').toString('hex');

  const term5 = rchainToken.readPursesTerm({
    masterRegistryUri,
    contractId: nameSystemContractId,
    pursesIds: [zone.origin]
  });
  const result5 = await rchainToolkit.http.exploreDeploy(readOnly, {
    term: term5
  });
  const data5 = rchainToolkit.utils.rhoValToJs(JSON.parse(result5).expr[0]);

  if (Object.keys(data5).length === 0) {
    return ['notexists', zone.origin, 'domain does not exist'];
  }
  if (data5[zone.origin].boxId === boxId) {
    let exploreDeployResponse;
    try {
      exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
        readOnly,
        {
          term: rchainToken.readPursesDataTerm({
            contractId: nameSystemContractId,
            masterRegistryUri,
            pursesIds: [zone.origin]
          })
        }
      );
      const parsedResponse = JSON.parse(exploreDeployResponse);
      const jsValue2 = rchainToolkit.utils.rhoValToJs(parsedResponse.expr[0]);
      if (jsValue2[zone.origin] === data) {
        return ['ok', zone.origin, 'domain is owned, and zone up to date'];
      }
      return ['notmatches', zone.origin, 'domain is owned, but zone is not up to date, either wait or update'];
    } catch (err) {
      log('Something went wrong during explore-deploy', 'error');
      throw err;
    }
  } else {
    return ['belongsotherbox', zone.origin, `domain belongs to another box than ${boxId}`];
  }
}

module.exports.checkZone = checkZone;

module.exports.check = async () => {
  const { config } = await checkConfig('zone');
  const check = async () => {
    const { masterRegistryUri } = config.options;
    if (!masterRegistryUri) {
      throw new Error('please provide .masterRegistryUri in dappy.config.json');
    }
    const { nameSystemContractId } = config.options;
    if (!nameSystemContractId) {
      throw new Error(
        'please provide .nameSystemContractId in dappy.config.json'
      );
    }

    // ===================
    // Check NFT contract and purse
    // ===================
    if (!config.zones || Object.keys(config.zones).length === 0) {
      throw new Error(
        'No zone to deploy, cannot find config.zone, or zero zones'
      );
    }

    /* console.log(`host (read-only)    : ${config.options.readOnly}`);
    console.log(`host (validator)    : ${config.options.validator}`);
    console.log(`shard ID            : ${config.options.shardId}`);
    console.log(`box ID              : ${config.options.boxId}`);
    console.log(`master registry URI : ${config.options.masterRegistryUri}\n`);
     */const checks = [];
    for (let i = 0; i < config.zones.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const c = await checkZone(config.zones[i], config.options);
      checks.push(c)
      if (checks.length === config.zones.length) {
        checks.forEach(c => {
          if (c[0] === 'ok') {
            console.log('\x1b[32m' + `✓ ${(c[1] + '.d').padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
          } else if (c[0] === 'notexists') {
            console.log('\x1b[31m' + `⨯ ${(c[1] + '.d').padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
          } else if (c[0] === 'notmatches') {
            console.log('\x1b[31m' + `⨯ ${(c[1] + '.d').padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
          } else if (c[0] === 'belongsotherbox') {
            console.log('\x1b[31m' + `⨯ ${(c[1] + '.d').padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
          } else {
            throw new Error('Unknown status')
          }
        })
      }
    }
  };

  check();
};
