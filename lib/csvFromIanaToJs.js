const fs = require('fs');

const csv = fs.readFileSync('./video.csv');

const mt = csv.toString('utf-8');

const mimeTypesAndExtensions = {};

mt.split('\n').forEach((a) => {
  const mimeType = a.split(',')[1];
  const ext = a.split(',')[0];
  if (mimeType && ext) {
    mimeTypesAndExtensions[ext] = mimeType;
  }
});

fs.writeFileSync('video.js', JSON.stringify(mimeTypesAndExtensions));
