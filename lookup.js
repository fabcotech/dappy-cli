const fs = require("fs");
const grpc = require("grpc");
const { RNode, RHOCore } = require("rchain-api");

const configFile = fs.readFileSync("dappy.config.json", "utf8");

function bufAsHex(prop, val) {
  if (prop === "data" && "type" in this && this.type === "Buffer") {
    return Buffer.from(val).toString("hex");
  }
  return val;
}

function logged(obj /*: mixed */, label /*: ?string */) {
  console.log(label, JSON.stringify(obj, bufAsHex, 2));
  return obj;
}

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

log("Starting lookup");

let rchain = RNode(grpc, {
  host: config.options.host,
  port: config.options.port
});

log("Will look for channel " + `@"${config.options.channel_id}"`);
rchain
  .listenForDataAtPublicName(config.options.channel_id)
  .then(blockResults => {
    if (!blockResults.length) {
      console.error("No block results");
      process.exit();
    }
    log(`${blockResults.length} block(s) found`);
    const block = blockResults[0];
    return rchain.listenForDataAtName(block.postBlockData.slice(-1).pop());
  })
  .then(blockResults => {
    for (let i = 0; i < blockResults.length; i += 1) {
      const block = blockResults[i];
      for (let j = 0; j < block.postBlockData.length; j += 1) {
        const data = JSON.stringify(
          RHOCore.toRholang(block.postBlockData[j]),
          bufAsHex,
          2
        );
        if (data) {
          log(
            `Received value from block n°${block.block.blockNumber}, ${new Date(
              parseInt(block.block.timestamp, 10)
            ).toISOString()}`
          );
          console.log(data);
          process.exit();
          return;
        }
      }
    }

    console.log(
      `Did not found any data for channel @"${config.options.channel_id}"`
    );
    process.exit();
  });
