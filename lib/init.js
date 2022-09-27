const fs = require('fs');

module.exports.init = () => {
  const configExampleFile = fs.readFileSync(
    './dappy.config.example.json',
    'utf8'
  );

  try {
    fs.readFileSync('./dappy.config.json', 'utf8');
    console.error(
      'dappy.config.json already exists, delete it and run script again'
    );
  } catch (err) {
    fs.writeFileSync('./dappy.config.json', configExampleFile, (e) => {
      if (e) {
        console.error(e);
      }
    });
    console.log('dappy.config.json created !');
  }
  process.exit();
};
