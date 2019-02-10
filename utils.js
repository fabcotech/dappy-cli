const fs = require("fs");
const ed25519 = require("ed25519");

module.exports.checkConfigFile = config => {
  if (
    typeof config.manifest.title !== "string" ||
    typeof config.manifest.subtitle !== "string" ||
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
    subtitle: config.manifest.subtitle,
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
  base64 = Buffer.from(manifest).toString("base64");
  const signatureBase64 = ed25519.Sign(
    Buffer.from(base64, "base64"),
    Buffer.from(privateKey, "hex")
  );
  return `${base64};${signatureBase64.toString("base64")}`;
};
