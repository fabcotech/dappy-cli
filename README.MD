## dappy-cli

Node JS cli to build and push dappy dapps to the RChain blockchain.

Dappy dapps are unique web applications, they are stored on the blockchain and loaded in the browser using a trustless co-resolution mechanism, making them very secure and censorship resistant.

Dapps are pushed as NFT in a NFT contract from rchain-token. The address `contractId.purseId` must then be referenced in a record to be loaded a dappy compatible browser.

#### installation

```
npm install dappy-cli
```

#### scripts

Scripts to add in your package.json :

```json
{
  "dappy:init": "dappy-cli init",
  "dappy:push": "dappy-cli push"
}
```

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
{
  "dapp": {
    "html": "dist/dapp.html", // This will only be used as the title of the .dpy file
    "js": "dist/bundle.min.js", // path of your main application js file
    "css": "dist/bundle.min.css" // path of your main application css file
  },
  "options": {
    "platform": "rchain", // leave "rchain"
    "readOnly": "https://observer.testnet.rchain.coop", // url of the read-only node
    "validator": "https://node2.testnet.rchain.coop", // url of the validator node
    "privateKey": "", // private key to use for deployments, or path to a file
    "masterRegistryUri": "aaa", // rchain-token master registry URI
    "contractId": "mycontract", // rchain-token contract ID
    "purseId": "index", // rchain-token purse ID
    "boxId": "mybox" // rchain-token box ID
  }
}
```
