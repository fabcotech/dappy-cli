## dappy-cli

Node JS cli to build and livepush Dappy manifests to the RChain blockchain.

Using dappy-cli you can easily initialize, manage and push your web application to the blockchain. In other words, package your web application so it can be loaded in Dappy browser. It compiles your HTML, CSS and JS files into a base64 bundle, and pushed a Rholang code to store the manifest online.

This tool includes live-push (push a new version of your dapp everytimes a file changes), and public key / private key verification.

Once manifests is pushed, the dapp is instantly (or in a short period depending on consensus time) available in Dappy browser. Simply copy and paste the unforgeable name id in the search bar, and of course check that blockchain settings are correctly configured.

#### installation

```
  npm install dappy-cli
```

#### scripts

Scripts to add in your package.json :

```json
{
  "dappy:init": "node ./node_modules/dappy-cli/lib/ init",
  "dappy:push": "node ./node_modules/dappy-cli/lib/ push"
}
```

##### Value replacement before push

Dappy will replace the following expression if they are found in the bundled html file :

- `MASTER_REGISTRY_URI` : replaced by the master registry URI from `dappy.config.json`
- `PUBLIC_KEY` : replaced by the public key from `dappy.config.json`
- `FULL_ADDRESS` : replaced with the full address of the file (`CONTRACT_ID.PURSE_ID`)
- `REV_ADDRESS` : replaced with the REV address (obtained from private key)
- `DAPPY_FILE`: replaced by the content of the created DPY file

#### dappy.config.json config file

This file defines some properties of your dappy application, the ressources you'll need like JS or CSS libraries, and finally the path of your app's ressources (main JS and CSS files).

To init the `dappy.config.json` file with default values run `npm run dappy:init`.

```javascript
{
  "manifest": {
    "title": "My dapp", // This will only be used as the title of the .dpy file
    "jsPath": "dist/bundle.min.js", // path of your main application js file
    "cssPath": "dist/bundle.min.css" // path of your main application css file
  },
  "options": {
    "platform": "rchain", // leave "rchain"
    "readOnly": "https://observer.testnet.rchain.coop", // url of the read-only node
    "validator": "https://node2.testnet.rchain.coop", // url of the validator node
    "privateKey": "", // private key to use for deployments
    "masterRegistryUri": "aaa", // rchain-token master registry URI
    "contractId": "mycontract", // rchain-token contract ID
    "purseId": "index", // rchain-token purse ID
    "boxId": "mybox" // rchain-token box ID
  }
}
```

#### HTML file requirements

#### Import dappy local js/css libraries

Dappy has locally some JS and CSS libraries available. (to be written)

#### Inferred mime types

When you use the push-file script, the mimeType will be guessed based on the file extension. We will set the mimeType based on this list. You can also pass the --mimeType command line option to override this.

https://www.iana.org/assignments/media-types/media-types.xhtml
