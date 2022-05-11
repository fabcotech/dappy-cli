## Dappy CLI

NodeJS utility to publish dapp and manage zone and records in the dappy name system

**What are record, and what is the dappy name system ?**

The dappy name system is an alternative to the DNS, that is powered by the blockchain and a powerful, trustless co-resolution system that make it very secure, resilient and accurate. A record is simply an Top Level Domain / TLD entry in the dappy name system.

**What are dapps in a dappy context ?**

Dappy dapps are unique web applications, they are stored on the blockchain and loaded in the browser using a trustless co-resolution mechanism, making them very secure and censorship resistant.

Dapps are pushed as NFT in a NFT contract from rchain-token. The address `contractId.purseId` must then be referenced in a record to be loaded a dappy compatible browser.

[fabco.gitbook.io/dappy-spec](https://fabco.gitbook.io/dappy-spec/) will provide you with more context.

#### installation

```
npm install @fabcotech/dappy-cli
```

#### scripts

npx provides the following commands

```sh
npx @fabcotech/dappy-cli init
npx @fabcotech/dappy-cli pushdapp
npx @fabcotech/dappy-cli pushzones
npx @fabcotech/dappy-cli nginx --host x.dappy
npx @fabcotech/dappy-cli apache --host x.dappy
npx @fabcotech/dappy-cli generateselfsignedcert --host x.dappy
```

### Configuration of the options

Options configuration must be in a `dappy.config.json` file. You can initiate a template with `npx @fabcotech/dappy-cli init` command.

```javascript
// dappy.config.json
{
  ...
  "options": {
    "platform": "rchain", // leave "rchain"
    "readOnly": "https://observer.testnet.rchain.coop", // url of the read-only node
    "validator": "https://node2.testnet.rchain.coop", // url of the validator node
    "masterRegistryUri": "aaa", // rchain-token master registry URI
    "privateKey": ".privatekey", // private key to use for deployments OR path to a text file
    "boxId": "mybox" // rchain-token box ID

    // only used for pushdapp
    "contractId": "mycontract", // rchain-token contract ID
    "purseId": "index", // rchain-token purse ID

    // only used for pushzones
    "nameSystemContractId": "dappynamesystem", // rchain-token contract ID of the name system NFT contract²
  }
  ...
}
```

### Zones and records in the dappy name system

In dappy, records are the entry of the dappy name system, Amazon own `amazon.com` in the DNS, and they will own `amazon.dappy` record in the dappy name system.

Managing a zone and its records is done through the `dappy.config.json` file. You can do `npx @fabcotech/dappy-cli init` command to have an example file for the `helloworld.dappy` IP application.

```javascript
// dappy.config.json
{
  ...
  "zones": [{
      // the TLD you want to own in the dappy name system.
      "origin": "example",
      "ttl": 3600,
      "records": [
        // values or an IP app / TLS website
        {
          "name": "@",
          "type": "A",
          "data": "127.0.0.1"
        },
        {
          "name": "",
          "type": "CERT",
          "data": "LS0tLS1CRUdJTiBD="
        },
        // values for a DAPP
        {
          "name": "mynftcontract.mypage",
          "type": "DAPP"
        }
      ]
  }]
}
```

Check your `config.options` and run the following script to book or update your zone.

```sh
npx @fabcotech/dappy-cli pushzones
```

#### helloworld.dappy IP application (dev)

If you want to setup the helloworld.dappy example just push the default zones, and run the helloworld web server with Deploy your zone using [dappy-node](https://github.com/fabcotech/dappy-node).

### Nginx and Apache configurations

If you are deploying an IP application you'll need a TLS certificate, dappy-cli can help you generate one (it uses `pem` npm library).

```sh
npx @fabcotech/dappy-cli generateselfsignedcert --host x.dappy
```

Run the following scripts to output the minimal configuration for Apache or NGINX on your web server.

```sh
# nginx
npx @fabcotech/dappy-cli nginx --host x.dappy
npx @fabcotech/dappy-cli nginx --host x.dappy --commands

# apache
npx @fabcotech/dappy-cli apache --host x.dappy
npx @fabcotech/dappy-cli apache --host x.dappy --commands
```

### Dapps, or blockchain web applications

##### Value replacement before push

Dappy will replace the following expression if they are found in the bundled html file :

- `MASTER_REGISTRY_URI` : replaced by the master registry URI from `dappy.config.json`
- `PUBLIC_KEY` : replaced by the public key from `dappy.config.json`
- `FULL_ADDRESS` : replaced with the full address of the file (`CONTRACT_ID.PURSE_ID`)
- `REV_ADDRESS` : replaced with the REV address (obtained from private key)

#### dappy.config.json config file

This file defines some properties of your dappy application, the ressources you'll need like JS or CSS libraries, and finally the path of your app's ressources (javascript and stylesheets).

To init the `dappy.config.json` file with default values run `npx dappy-cli init`.

```javascript
// dappy.config.json
{
  ...,
  "dapp": {
    "html": "dist/dapp.html", // This will only be used as the title of the .dpy file
    "js": "dist/bundle.min.js", // path of your main application js file
    "css": "dist/bundle.min.css" // path of your main application css file
  },
  ...
}
```

Check your `config.options` and run the following script to book or update your dapp.

```sh
npx @fabcotech/dappy-cli pushdapp
```