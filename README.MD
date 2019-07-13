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
  "dappy:build": "node ./node_modules/dappy-cli/lib/ build",
  "dappy:push": "node ./node_modules/dappy-cli/lib/ push",
  "dappy:update": "node ./node_modules/dappy-cli/lib/ update",
  "dappy:watch": "node ./node_modules/dappy-cli/lib/ update --watch"
}
```

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
    "platform": "rchain", // leave "rchain" for now since it's the only platform supported
    "host": "localhost", // host of the RChain node you want to connect to
    "port": "40401", // port of the RChain node you want to connect to
    "private_key": "abcdef" // ED25519 private key
    "public_key": "abc" // ED25519 Corresponding public key
    "registry_uri": "hugyft56434...." // registry URI for the update of the dapp (logged by rnode after push has been ran),
    "unforgeable_name_id": "ha765230gh...." // unforgeable name ID, blockchain address of the dapp manifest
  }
}
```

#### HTML file requirements

#### Import dappy local js/css libraries
