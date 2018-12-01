## dappy-dev

Node JS dev kit to build and livepush dappy manifests to the RChain blockchain.

Requisite: have a running RChain node.

#### scripts

Scripts to add in your package.json :

```json
{
  "dappy-dev:init": "node ./node_modules/dappy-dev/index.js --init",
  "dappy-dev:build": "node ./node_modules/dappy-dev/index.js --build",
  "dappy-dev:push": "node ./node_modules/dappy-dev/index.js",
  "dappy-dev:watch": "node ./node_modules/dappy-dev/index.js --watch"
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
    "description": "Cool dapp to handle grosseries with friends", // Description of your dapp
    "author": "Willy", // Author, likely you
    "cssLibraries": ["bulma@0.x"], // css libraries your dapp relies on, and you don't want to include in your css bundle
    "jsLibraries": [
      "react@latest",
      "react-dom@latest",
      "react-redux@5.0.7"
    ], // js libraries your dapp relies on, and you don't want to include in your js bundle
    "jsPath": "dist/bundle.min.js", // path of your main application js file
    "cssPath": "dist/bundle.min.css" // path of your main application css file
  },
  "options": {
    "platform": "rchain", // leave "rchain" for now since it's the only platform supported
    "livePush": true, // leave "rchain" for now since it's the only platform supported
    "host": "localhost", // host of the RChain node you want to connect to
    "port": "40401", // port of the RChain node you want to connect to
    "channel_id": "mychannel" // public channel you want to push your manifest to (on the blockchain, ex: "mychannel" will push manifest to @"mychannel"!(*manifest)
  }
}
```
