const fs = require('fs');
const path = require('path');

module.exports.init = () => {
  const configExampleFile = fs.readFileSync(
    path.resolve(__dirname, './dappy.config.example.json'),
    'utf8'
  );

  try {
    fs.readFileSync(path.resolve(process.cwd(), 'dappy.config.json'), 'utf8');
    console.error(
      'dappy.config.json already exists, delete it and run script again'
    );
  } catch (err) {
    fs.writeFileSync(
      path.resolve(process.cwd(), 'dappy.config.json'),
      configExampleFile,
      (e) => {
        if (e) {
          console.error(e);
        }
      }
    );
    console.log('dappy.config.json created !');
  }
  process.exit();
};
