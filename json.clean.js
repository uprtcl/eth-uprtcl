'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

var myArgs = process.argv.slice(2);
const root = myArgs[0]

const pattern = path.join(root, '*.json');

glob(pattern, (er, files) => {
  files.forEach((file) => {
    if (file.slice(file.length - 8) !== 'min.json') {
      const json = JSON.parse(fs.readFileSync(file));
      const jsonMin = {
        abi: json.abi,
        networks: json.networks
      }
      
      let data = JSON.stringify(jsonMin);
      const parts = path.parse(file);
      fs.writeFileSync(path.join(parts.dir, `${parts.name}.min.json`), data);
    }    
  })
});