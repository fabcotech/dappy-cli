const fs = require('fs');
const rchainToolkit = require('@fabcotech/rchain-toolkit');
const rchainToken = require('@fabcotech/rchain-token');

const checkZone = require('./check').checkZone;
const { checkConfig, deployBox, log } = require('./utils');

async function addZone(
  zone,
  purseZero,
  options
) {
  const {
    masterRegistryUri,
    nameSystemContractId,
    readOnly,
    validator,
    shardId,
    privateKey,
    boxId
  } = options;

  let s = 'Zone update was successfully deployed';

  let purseId = zone.origin;
  if (purseId.endsWith('.dappy') || purseId.endsWith('.d')) {
    purseId = purseId.split('.').slice(0, purseId.split('.').length - 1).join('.')
  }

  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);

  const c = await checkZone(zone, options);
  if (c[0] === 'notexists') {
    let term6;
    log(`purse ${purseId} not found, lets SWAP it with wrapped REV`);
    log('preparing rchain-token.CREDIT and rchain-token.SWAP operations');
    term6 = rchainToken.creditAndSwapTerm(
      {
        revAddress: rchainToolkit.utils.revAddressFromPublicKey(publicKey),
        quantity: purseZero.price[1],
        masterRegistryUri,
        boxId
      },
      {
        masterRegistryUri,
        purseId: '0',
        contractId: nameSystemContractId,
        boxId,
        quantity: 1,
        newId: purseId,
        merge: false
      }
    );

    const dataAtNameResponse6 = await rchainToolkit.http.easyDeploy(
      validator,
      {
        term: term6,
        shardId,
        privateKey,
        phloPrice: 'auto',
        phloLimit: 100000000,
        timeout: 8 * 60 * 1000
      }
    );

    const data6 = rchainToolkit.utils.rhoValToJs(
      JSON.parse(dataAtNameResponse6).exprs[0].expr
    );

    if (data6.status !== 'completed') {
      console.log(data6);
      throw new Error();
    }
    s = 'Domain purchase + zone update was successfully deployed';
  }

  const data = Buffer.from(JSON.stringify(zone), 'utf8').toString('hex');

  log('preparing rchain-token.UPDATE_PURSE_DATA operation');
  const payload = {
    masterRegistryUri,
    purseId,
    boxId,
    contractId: nameSystemContractId,
    data
  };

  const term7 = rchainToken.updatePurseDataTerm(payload);
  let dataAtNameResponse7;
  try {
    dataAtNameResponse7 = await rchainToolkit.http.easyDeploy(
      validator,
      {
        term: term7,
        shardId: shardId,
        privateKey: privateKey,
        phloPrice: 'auto',
        phloLimit: 10000000,
        timeout: 8 * 60 * 1000
      }
    );
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }

  const data7 = rchainToolkit.utils.rhoValToJs(
    JSON.parse(dataAtNameResponse7).exprs[0].expr
  );

  if (data7.status !== 'completed') {
    console.log(data7);
    throw new Error();
  }

  log(s);

  return 1;
}

module.exports.pushZones = async () => {
  const { config, privateKey, publicKey } = await checkConfig('zone');

  const httpUrlReadOnly = config.options.readOnly;
  const httpUrlValidator = config.options.validator;

  let performPushes = [];

  const push = async () => {
    log(`host (read-only):  ${config.options.readOnly}`);
    log(`host (validator):  ${config.options.validator}`);
    log(`shard ID        :  ${config.options.shardId}`);
    log(`public key      :  ${publicKey}`);
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
    // Check box
    // ===================

    let { boxId } = config.options;
    if (!boxId) {
      boxId = `${masterRegistryUri.slice(0, 3)}${Math.round(Math.random() * 1000000).toString()}`;
      config.options.boxId = boxId;
      fs.writeFileSync(
        'dappy.config.json',
        JSON.stringify(config, null, 2),
        'utf8'
      );
      log('boxId not found, created config.boxId with a random number');
    }
    if (boxId.slice(0, 3) !== masterRegistryUri.slice(0, 3)) {
      throw new Error('Make sure your boxId has the right prefix that matches master : ' + masterRegistryUri.slice(0, 3))
    }

    const term1 = rchainToken.readBoxTerm({
      masterRegistryUri,
      boxId
    });
    const result1 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term1
    });
    if (!JSON.parse(result1).expr[0]) {
      throw new Error(
        'Box not found'
      );
    }

    const boxData = rchainToolkit.utils.rhoValToJs(JSON.parse(result1).expr[0]);
    if (boxData === 'error: box not found') {
      log('deploying box now');
      boxId = await deployBox(
        httpUrlValidator,
        config.options.shardId,
        privateKey,
        publicKey,
        masterRegistryUri,
        boxId.slice(3)
      );
      log(
        `box "${boxId}" deployed in master contract`
      );
    } else {
      log('box found');
    }

    const term8 = rchainToken.readPursesTerm({
      masterRegistryUri,
      contractId: nameSystemContractId,
      pursesIds: ['0'],
    });
    const result8 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term8
    });

    const purseZero = rchainToolkit.utils.rhoValToJs(
      JSON.parse(result8).expr[0]
    )['0'];

    // ===================
    // Check NFT contract and purse
    // ===================
    if (!config.zones || Object.keys(config.zones).length === 0) {
      throw new Error(
        'No zone to deploy, cannot find config.zone, or zero zones'
      );
    }

    let deployeds = []
    for (let i = 0; i < performPushes.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      deployeds.push(
        await addZone(
          config.zones.find(z => z.origin === performPushes[i][1]),
          purseZero,
          config.options
        )
      );
      if (deployeds.length === performPushes.length) {
        log('Purchases and updates were deployed, now do dappy-cli check to verify the state of your domains')
      }
    }
  };

  const checks = [];
  for (let i = 0; i < config.zones.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const c = await checkZone(config.zones[i], config.options);
    checks.push(c)
    if (checks.length === config.zones.length) {
      performPushes = checks.filter(c => ['notexists', 'notmatches'].includes(c[0]));
      const errors = checks.filter(c => ['belongsotherbox'].includes(c[0]));
      const oks = checks.filter(c => ['ok'].includes(c[0]));
      oks.forEach(c => {
        console.log('\x1b[32m' + `✓ ${c[1].padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
      });
      errors.forEach(e => {
        console.log('\x1b[31m' + `⨯ ${c[1].padEnd(17, ' ')}` + '\x1b[0m' + ` : ${c[2]}`);
      });
      if (performPushes.length > 0) {
        console.log('Will process the following zones : \x1b[36m' + performPushes.map(p => p[1]).join(', ') + '\x1b[0m');
        push();
      } else {
        console.log('No zone to process, everything is up to date')
      }
    }
  }
};
