const rchainToolkit = require('rchain-toolkit');
const rchainToken = require('rchain-token');

const { logDappy, checkConfig, deployBox, log } = require('./utils');

async function addZone(
  zone,
  purseZero,
  {
    masterRegistryUri,
    nameSystemContractId,
    readOnly,
    validator,
    privateKey,
    boxId
  }
) {
  const purseId = zone.origin;

  const term5 = rchainToken.readPursesTerm({
    masterRegistryUri,
    contractId: nameSystemContractId,
    pursesIds: [purseId]
  });
  const result5 = await rchainToolkit.http.exploreDeploy(readOnly, {
    term: term5
  });
  const data5 = rchainToolkit.utils.rhoValToJs(JSON.parse(result5).expr[0]);

  const data = Buffer.from(JSON.stringify(zone), 'utf8').toString('hex');

  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);
  let term6;
  if (Object.keys(data5).length === 0) {
    log(`purse ${purseId} not found, lets SWAP it with wrapped REV`);
    log('will do rchain-token.SWAP operation');
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
        data,
        newId: purseId,
        merge: false
      }
    );
  } else {
    log(
      `purse ${purseId} found in name system contract, just update purse data`
    );
    log('will do rchain-token.UPDATE_PURSE_DATA operation');
    const payload = {
      masterRegistryUri,
      purseId,
      boxId,
      contractId: nameSystemContractId,
      data
    };

    term6 = rchainToken.updatePurseDataTerm(payload);
  }

  let dataAtNameResponse6;
  try {
    dataAtNameResponse6 = await rchainToolkit.http.easyDeploy(
      validator,
      term6,
      privateKey,
      1,
      10000000,
      8 * 60 * 1000
    );
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }

  const data6 = rchainToolkit.utils.rhoValToJs(
    JSON.parse(dataAtNameResponse6).exprs[0].expr
  );

  if (data6.status !== 'completed') {
    console.log(data6);
    throw new Error();
  }

  log('Now trying to get zone/NFT from the blockchain...');

  let checkingDataOnChain = false;
  const isDataOnChain = async () => {
    if (checkingDataOnChain) {
      return false;
    }
    checkingDataOnChain = true;

    let exploreDeployResponse;
    try {
      exploreDeployResponse = await rchainToolkit.http.exploreDeploy(
        readOnly,
        {
          term: rchainToken.readPursesDataTerm({
            contractId: nameSystemContractId,
            masterRegistryUri,
            pursesIds: [purseId]
          })
        }
      );
    } catch (err) {
      log('Something went wrong during explore-deploy', 'error');
      throw err;
    }

    if (exploreDeployResponse.includes('out of phlogistons')) {
      log('Something went wrong during explore-deploy', 'error');
      throw new Error(exploreDeployResponse);
    }

    checkingDataOnChain = false;
    const parsedResponse = JSON.parse(exploreDeployResponse);

    if (typeof parsedResponse === 'string') {
      log('Something went wrong during explore-deploy', 'error');
      throw new Error(parsedResponse);
    }
    if (!parsedResponse || !parsedResponse.expr[0]) {
      log('Transaction data not found (file upload), will retry in 15 seconds');
      return false;
    }

    const jsValue2 = rchainToolkit.utils.rhoValToJs(parsedResponse.expr[0]);

    if (jsValue2) {
      if (jsValue2[purseId] === data) {
        log('Zone successfuly deployed in name system !');
        log(`masterRegistryUri :                ${masterRegistryUri}`);
        log(`contract id :                      ${nameSystemContractId}`);
        log(`zone id :                        ${purseId}`);
        log(`Box owning this zone/NFT:        ${boxId}`);
        return true;
      }
      if (typeof jsValue2 === 'string') {
        const msg = 'Something went wrong, value of the file on chain is not the same as value sent, value(0-40)';
        log(
          msg,
          'error'
        );
        console.log(`${jsValue2.substr(0, 40)}...`);
        log('Should be (0-40):', 'error');
        console.log(`${data.substr(0, 40)}...`);
        throw new Error();
      } else {
        log(
          'Something went wrong, value of the file on chain is not the same as value sent, value :',
          'error'
        );
        console.log(jsValue2);
        log('Should be (0-40):', 'error');
        console.log(`${data.substr(0, 40)}...`);
        throw new Error();
      }
    } else {
      log('Error retreiving transaction data, will retry in 15 seconds');
    }
    return false;
  };

  while (!isDataOnChain()) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 15000); });
  }
}

module.exports.pushZones = async () => {
  logDappy();

  const { config, privateKey, publicKey } = await checkConfig('zone');

  log(`host (read-only):  ${config.options.readOnly}`);
  log(`host (validator):  ${config.options.validator}`);
  const httpUrlReadOnly = config.options.readOnly;
  const httpUrlValidator = config.options.validator;

  log(`public key :       ${publicKey}`);
  log('Compiling !');

  const push = async () => {
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
      throw new Error(
        'Please provide .boxId in dappy.config.json, if it does not exist in aster contract, it will be created'
      );
    }

    const term1 = rchainToken.readBoxTerm({
      masterRegistryUri,
      boxId
    });
    const result1 = await rchainToolkit.http.exploreDeploy(httpUrlReadOnly, {
      term: term1
    });

    const boxData = rchainToolkit.utils.rhoValToJs(JSON.parse(result1).expr[0]);
    if (boxData === 'error: box not found') {
      log('deploying box now');
      boxId = await deployBox(
        httpUrlValidator,
        privateKey,
        publicKey,
        masterRegistryUri,
        boxId
      );
      log(
        `box "${boxId}" deployed in master contract, PLEASE UPDATE dappy.config.json file`
      );
    } else {
      log('box found');
    }

    const term8 = rchainToken.readPursesTerm({
      masterRegistryUri,
      contractId: nameSystemContractId,
      pursesIds: ['0']
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

    for (let i = 0; i < config.zones.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await addZone(config.zones[i], purseZero, config.options);
    }
  };

  push();
};
