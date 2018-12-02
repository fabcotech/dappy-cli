const fs = require("fs");
const grpc = require("grpc");
const { RNode } = require("rchain-api");

const WATCH = !!process.argv.find(a => a === "--watch");
const BUILD = !!process.argv.find(a => a === "--build");
const INIT = !!process.argv.find(a => a === "--init");

if (INIT) {
  const configExampleFile = fs.readFileSync(
    __dirname + "/dappy.config.example.json",
    "utf8"
  );

  try {
    fs.readFileSync("dappy.config.json", "utf8");
    console.error(
      "dappy.config.json already exists, delete it and run script again"
    );
  } catch (err) {
    fs.writeFileSync("dappy.config.json", configExampleFile, err => {
      if (err) {
        console.error(err);
      }
    });
    console.log("dappy.config.json created !");
  }
  process.exit();
}

const configFile = fs.readFileSync("dappy.config.json", "utf8");

let js;
let css;
let base64;
let jsonStringified;

console.log(`
:::::::::      :::     :::::::::  :::::::::  :::   ::: 
:+:    :+:   :+: :+:   :+:    :+: :+:    :+: :+:   :+:  
+:+    +:+  +:+   +:+  +:+    +:+ +:+    +:+  +:+ +:+    
+#+    +:+ +#++:++#++: +#++:++#+  +#++:++#+    +#++:      
+#+    +#+ +#+     +#+ +#+        +#+           +#+        
#+#    #+# #+#     #+# #+#        #+#           #+#         
#########  ###     ### ###        ###           ###          
`);
if (!configFile) {
  throw new Error("No config file");
}

const log = a => {
  console.log(new Date().toISOString(), a);
};

let config;
try {
  config = JSON.parse(configFile);
} catch (err) {
  throw new Error("Unable to parse config file");
}

if (
  typeof config.manifest.title !== "string" ||
  typeof config.manifest.subtitle !== "string" ||
  typeof config.manifest.author !== "string" ||
  typeof config.manifest.description !== "string" ||
  typeof config.manifest.jsPath !== "string" ||
  typeof config.manifest.cssPath !== "string" ||
  !Array.isArray(config.manifest.cssLibraries) ||
  !Array.isArray(config.manifest.jsLibraries)
) {
  throw new Error("Invalid config file");
}

let rchain;
const clock = () => new Date();
if (!BUILD) {
  console.log("host:", config.options.host);
  console.log("port:", config.options.port);
  rchain = RNode(grpc, {
    host: config.options.host,
    port: config.options.port
  });
}

fs.watchFile(config.manifest.jsPath, () => {
  createManifest();
});

fs.watchFile(config.manifest.cssPath, () => {
  createManifest();
});

if (WATCH) {
  log("Watching for file changes !");
} else {
  log("Compiling !");
}

const createManifest = () => {
  js = fs.readFileSync(config.manifest.jsPath, "utf8");
  css = fs.readFileSync(config.manifest.cssPath, "utf8");

  jsonStringified = JSON.stringify({
    title: config.manifest.title,
    subtitle: config.manifest.subtitle,
    author: config.manifest.author,
    description: config.manifest.description,
    cssLibraries: config.manifest.cssLibraries,
    jsLibraries: config.manifest.jsLibraries,
    js: js,
    css: css,
    version: "0.1"
  });
  base64 = Buffer.from(jsonStringified).toString("base64");

  fs.writeFileSync("manifest.json", jsonStringified, err => {
    exit(i);
    if (err) {
      console.error(err);
    }
  });
  if (BUILD) {
    log("manifest.json created !");
  }

  fs.writeFileSync("manifest.base64", base64, err => {
    if (err) {
      console.error(err);
    }
  });
  if (BUILD) {
    log("manifest.base64 created !");
  }

  if (BUILD) {
    process.exit();
  }

  const codeWithRegistry = `
  new
    uriChannel,
    private,
    receiverChannel,
    lookup(\`rho:registry:lookup\`),
    insertArbitrary(\`rho:registry:insertArbitrary\`),
    stdout(\`rho:io:stdout\`) in {
      insertArbitrary!("${base64}" , *uriChannel) |

      for(uri <- uriChannel) {
        // stdout!("registry address : " ++ *uri) |
        lookup!(*uri, *receiverChannel) |
        for(value <- receiverChannel) {
          // stdout!("will store this value in registry : " ++ *value) |
          private!(*value) |
          @"${config.options.channel_id}"!(*private)
        }
      }
  }`;

  const codeWithoutRegistry = `
  new private in {
      private!("${base64}") |
      @"${config.options.channel_id}"!(*private)
  }`;

  rchain
    .doDeploy({
      term: codeWithoutRegistry,
      timestamp: clock().valueOf(),
      from: "0x1",
      nonce: 0,
      phloPrice: { value: 1 },
      phloLimit: { value: 100000 }
    })
    .then(deployMessage => {
      log("doDeploy result:", deployMessage);
      return rchain.createBlock();
    })
    .then(blockCreated => {
      log("block created");
      if (!WATCH) {
        process.exit();
      }
    });
};

createManifest();
