## dappy-dev

Node JS dev kit to build and livepush Dappy manifests to the RChain blockchain.

dappy-node bundles some general information about your dapp and the ressources of your dapp (js, css), puts them all in one big JSON file, and converts it to a base 64. This resulting long string can then be pushed to the blockchain, often stored in a smart contract. Then on the client side, someone you just have to share the RChain channel you pushed your code onto, and Dappy users will be able to easily load and execute your dapp code in Dappy.

Requisite: have a running RChain node.

#### installation

This library is not currently on npm, install it by adding this dependy to your `package.json` file

```json
  "dappy-dev": "https://github.com/fabcotech/dappy-dev"
```

#### scripts

Scripts to add in your package.json :

```json
{
  "dappy-dev:init": "node ./node_modules/dappy-dev/init.js",
  "dappy-dev:build": "node ./node_modules/dappy-dev/build.js",
  "dappy-dev:push": "node ./node_modules/dappy-dev/push.js",
  "dappy-dev:update": "node ./node_modules/dappy-dev/update.js",
  "dappy-dev:watch": "node ./node_modules/dappy-dev/update.js --watch",
  "dappy-dev:lookup": "node ./node_modules/dappy-dev/lookup.js"
}
```

#### dappy.config.json config file

This file defines some properties of your dappy application, the ressources you'll need like JS or CSS libraries, and finally the path of your app's ressources (main JS and CSS files).

To init the `dappy.config.json` file with default values run `npm run dappy-dev:init`.

```javascript
{
  "manifest": {
    "title": "My dapp", // Title of your dapp
    "subtitle": "My cool dapp", // Subtitle of your dapp
    "description": "Cool dapp you should try out !", // Description of your dapp
    "author": "Willy", // Author, likely you
    "cssLibraries": ["bulma@0.x"], // css libraries your dapp relies on, and you don't want to include in your css bundle
    "jsLibraries": [
      "react@16.7.0",
      "react-dom@16.7.0",
      "react-redux@6.0.0",
      "redux@4.0.1"
    ], // js libraries your dapp relies on, and you don't want to include in your js bundle
    "jsPath": "dist/bundle.min.js", // path of your main application js file
    "cssPath": "dist/bundle.min.css" // path of your main application css file
  },
  "options": {
    "platform": "rchain", // leave "rchain" for now since it's the only platform supported
    "host": "localhost", // host of the RChain node you want to connect to
    "port": "40401", // port of the RChain node you want to connect to
    "private_key": "abcdef" // ED25519 private key
    "public_key": "abc" // ED25519 Corresponding public key
    "channel": "mychannel" // Public name you wish to push the data onto, in this example: @"mychannel"
  }
}
```
