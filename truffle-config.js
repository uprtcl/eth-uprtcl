require('dotenv').config();
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      from: '0x1dF62f291b2E969fB0849d99D9Ce41e2F137006e' // -d [9]
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.endpoint)
      },
      gasPrice: 25000000000,
      network_id: 4
    }
  },

  solc: {
    version: '^0.5.0',
    optimizer: {
      enabled: true,
      runs: 200
    }
  }

};
