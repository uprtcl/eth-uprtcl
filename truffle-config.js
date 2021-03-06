require('dotenv').config();
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.rinkebyEndpoint)
      },
      gasPrice: 25000000000,
      network_id: 4
    },
    xdai: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.xdaiEndpoint)
      },
      gasPrice: 25000000000,
      network_id: 100
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
