## dappy-cli

Node JS cli to build and livepush Dappy manifests to the RChain blockchain.

Using dappy-cli you can easily initialize, manage and push your web application to the blockchain. In other words, package your web application so it can be loaded in Dappy browser.

This tool includes live-push (pushe a new version of your dapp everytimes a file changes), and public key / private key verification.

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
