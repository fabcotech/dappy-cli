const fs = require("fs");
const ed25519 = require("ed25519");
var readline = require("readline");
var Writable = require("stream").Writable;

const log = a => {
  console.log(new Date().toISOString(), a);
};

module.exports.checkConfigFile = config => {
  if (
    typeof config.manifest.title !== "string" ||
    typeof config.manifest.author !== "string" ||
    typeof config.manifest.description !== "string" ||
    typeof config.manifest.jsPath !== "string" ||
    typeof config.manifest.cssPath !== "string" ||
    typeof config.manifest.htmlPath !== "string" ||
    !Array.isArray(config.manifest.cssLibraries) ||
    !Array.isArray(config.manifest.jsLibraries)
  ) {
    throw new Error("Invalid config file");
  }
};

module.exports.logDappy = () => {
  console.log(`
  :::::::::      :::     :::::::::  :::::::::  :::   ::: 
  :+:    :+:   :+: :+:   :+:    :+: :+:    :+: :+:   :+:  
  +:+    +:+  +:+   +:+  +:+    +:+ +:+    +:+  +:+ +:+    
  +#+    +:+ +#++:++#++: +#++:++#+  +#++:++#+    +#++:      
  +#+    +#+ +#+     +#+ +#+        +#+           +#+        
  #+#    #+# #+#     #+# #+#        #+#           #+#         
  #########  ###     ### ###        ###           ###          
  `);
};

module.exports.createManifestFromFs = config => {
  js = fs.readFileSync(config.manifest.jsPath, "utf8");
  css = fs.readFileSync(config.manifest.cssPath, "utf8");
  html = fs.readFileSync(config.manifest.htmlPath, "utf8");

  return JSON.stringify({
    title: config.manifest.title,
    author: config.manifest.author,
    description: config.manifest.description,
    cssLibraries: config.manifest.cssLibraries,
    jsLibraries: config.manifest.jsLibraries,
    js: js,
    css: css,
    html: html,
    version: "0.1"
  });
};

module.exports.createBase64WithSignature = (manifest, privateKey) => {
  try {
    base64 = Buffer.from(manifest).toString("base64");
    const signatureBase64 = ed25519.Sign(
      Buffer.from(base64, "base64"),
      Buffer.from(privateKey, "hex")
    );
    return `${base64};${signatureBase64.toString("base64")}`;
  } catch (err) {
    log("Invalid private key");
    console.log(err);
    process.exit();
  }
};

module.exports.privateKeyPrompt = () => {
  return new Promise(resolve => {
    var mutableStdout = new Writable({
      write: function(chunk, encoding, callback) {
        if (!this.muted) process.stdout.write(chunk, encoding);
        callback();
      }
    });

    mutableStdout.muted = false;

    var rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    rl.question("private key: ", function(privateKey) {
      rl.history = rl.history.slice(1);
      resolve(privateKey);
      rl.close();
    });

    mutableStdout.muted = true;
  });
};
