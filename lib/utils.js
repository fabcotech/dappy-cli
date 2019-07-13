const fs = require("fs");
var readline = require("readline");
var Writable = require("stream").Writable;
const elliptic = require("elliptic");

const ec = new elliptic.ec("secp256k1");

const log = a => {
  console.log(new Date().toISOString(), a);
};

module.exports.checkConfigFile = config => {
  if (
    typeof config.manifest.jsPath !== "string" ||
    typeof config.manifest.cssPath !== "string" ||
    typeof config.manifest.htmlPath !== "string" ||
    typeof config.manifest.title !== "string"
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

module.exports.createHtmlWithTags = config => {
  let js;
  if (config.manifest.jsPath) {
    js = fs.readFileSync(config.manifest.jsPath, "utf8");
  }
  let css;
  if (config.manifest.cssPath) {
    css = fs.readFileSync(config.manifest.cssPath, "utf8");
  }
  html = fs.readFileSync(config.manifest.htmlPath, "utf8");

  let headClosesIndex = html.indexOf("</head>");
  if (headClosesIndex === -1) {
    throw new Error("The html document has no closing </head> tag");
  }

  let cssTag;
  if (css) {
    cssTag = `<style>${css}</style>`;
    html =
      html.substr(0, headClosesIndex) + cssTag + html.substr(headClosesIndex);
  }

  headClosesIndex = html.indexOf("</head>");
  let jsTag;
  if (js) {
    jsTag = `<script>${js}</script>`;
    html =
      html.substr(0, headClosesIndex) + jsTag + html.substr(headClosesIndex);
  }

  let headOpensIndex = html.indexOf("<head>");
  if (headOpensIndex === -1) {
    throw new Error("The html document has no openning <head> tag");
  }

  headClosesIndex = html.indexOf("</head>");
  const dappyMetaTag = '<meta title="dappy:version" content="0.1" />';
  const matches = html.match(
    /\<meta title=\"dappy:version\" content=\"[0-9.]+\" ?\/?\>/g
  );
  if (matches) {
    html = html.replace(matches[0], dappyMetaTag);
  } else {
    html =
      html.substr(0, headOpensIndex + "<head>".length) +
      dappyMetaTag +
      html.substr(headOpensIndex + "<head>".length);
  }

  return html;
};

module.exports.createBase64WithSignature = (htmlWithTags, privateKey) => {
  base64 = Buffer.from(htmlWithTags).toString("base64");
  const keyPair = ec.keyFromPrivate(privateKey);
  const signature = keyPair.sign(Buffer.from(base64));
  const signatureHex = Buffer.from(signature.toDER()).toString("hex");

  if (
    !ec.verify(
      Buffer.from(base64),
      signature,
      keyPair.getPublic().encode("hex"),
      "hex"
    )
  ) {
    log("Signature verification failed");
    process.exit();
  }

  return `${base64};${signatureHex}`;
};

module.exports.createDpy = (fileName, base64) => {
  return Buffer.from(
    JSON.stringify({
      type: "application/dappy",
      name: `${fileName}.dpy`,
      data: base64
    })
  ).toString("base64");
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

module.exports.sanitizeFileName = a => {
  return a.replace(/[^a-z0-9]/gi, "_").toLowerCase();
};
