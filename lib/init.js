const fs = require("fs");

const logDappy = require("./utils").logDappy;

module.exports.init = () => {
  logDappy();

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
};
