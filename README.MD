## Dappy CLI

NodeJS utility to publish dapp and manage records in the dappy name system

**What are record, and what is the dappy name system ?**

The dappy name system is an alternative to the DNS, that is powered by the blockchain and a powerful, trustless co-resolution system that make it very secure, resilient and accurate. A record is simply an Top Level Domain / TLD entry in the dappy name system.

**What are dapps in a dappy context ?**

Dappy dapps are unique web applications, they are stored on the blockchain and loaded in the browser using a trustless co-resolution mechanism, making them very secure and censorship resistant.

Dapps are pushed as NFT in a NFT contract from rchain-token. The address `contractId.purseId` must then be referenced in a record to be loaded a dappy compatible browser.

[fabco.gitbook.io/dappy-spec](https://fabco.gitbook.io/dappy-spec/) will provide you with more context.

#### installation

```
npm install dappy-cli
```

#### scripts

Scripts to add in your package.json :

```json
{
  "dappy:init": "dappy-cli init",
  "dappy:push": "dappy-cli pushdapp",
  "dappy:pushrecord": "dappy-cli pushrecord"
}
```

Or with npx

```sh
npx dappy-cli init
npx dappy-cli pushdapp
npx dappy-cli pushrecord
```

### General configuration

General configuration must be in a `dappy.config.json` file. You can initiate a template with `npx dappy-cli init` command.

```javascript
// dappy.config.json
{
  ...
  "options": {
    "platform": "rchain", // leave "rchain"
    "readOnly": "https://observer.testnet.rchain.coop", // url of the read-only node
    "validator": "https://node2.testnet.rchain.coop", // url of the validator node
    "masterRegistryUri": "aaa", // rchain-token master registry URI
    "privateKey": "", // private key to use for deployments OR path to a text file
    "boxId": "mybox" // rchain-token box ID

    // only used for pushdapp
    "contractId": "mycontract", // rchain-token contract ID
    "purseId": "index", // rchain-token purse ID

    // only used for pushrecord
    "nameSystemContractId": "dappynamesystem", // rchain-token contract ID of the name system NFT contract²
  }
  ...
}
```

### Records in the dappy name system

In dappy, records are the entry of the dappy name system, Amazon own `amazon.com` in the DNS, and they will own `amazon` record in the dappy name system.

Managing a record is done through the `dappy.config.json` file. You can do `npm run dappy:init` command to have a template file.

```javascript
// dappy.config.json
{
  ...
  "record": {
    // the TLD you want to own in the dappy name system.
    "id": "amazoon"
    // values or an IP app / TLS website
    "values": [{
      "value": "192.168.0.1",
      "kind": "IPv4"
    }, {
      "value": "LS0tLS1CRUdJTiBD=",
      "kind": "caCert"
    }],
    // values for a dapp
    "values": [{
      "value": "mynftcontract.mypage",
      "kind": "dapp"
    }],
    // ca is a list of base64 certificate linked to the TLD, it will often
    // contain only one certificate, it may or may not be self signed
    "ca": ["123456789ABCDEF"]
  }
  ...
}
```

Check your `config.options` and run the following script to book or update your record.

```sh
npx dappy-cli pushrecord
```

Run the following scripts to know the minimal configuration for Apache or NGINX on your web server

```sh
# nginx
node index.js nginx
node index.js nginx --commands

# apache
node index.js apache
node index.js apache --commands
```

### Dapps, or blockchain web applications

##### Value replacement before push

Dappy will replace the following expression if they are found in the bundled html file :

- `MASTER_REGISTRY_URI` : replaced by the master registry URI from `dappy.config.json`
- `PUBLIC_KEY` : replaced by the public key from `dappy.config.json`
- `FULL_ADDRESS` : replaced with the full address of the file (`CONTRACT_ID.PURSE_ID`)
- `REV_ADDRESS` : replaced with the REV address (obtained from private key)

#### dappy.config.json config file

This file defines some properties of your dappy application, the ressources you'll need like JS or CSS libraries, and finally the path of your app's ressources (main JS and CSS files).

To init the `dappy.config.json` file with default values run `npm run dappy:init`.

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

Check your `config.options` and run the following script to book or update your record.

```sh
npx dappy-cli pushdapp
```