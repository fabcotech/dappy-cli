module.exports.checkConfigFile = config => {
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
