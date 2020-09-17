require('dotenv').config();
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      gasPrice: 30000000000,
      network_id: "*"
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.rinkebyEndpoint)
      },
      gasPrice: 25000000000,
      network_id: 4
    },
    kovan: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.kovanEndpoint)
      },
      gasPrice: 25000000000,
      network_id: 42
    },
    mainnet: {
      provider: () => {
        return new HDWalletProvider(process.env.mnemonic, process.env.mainnetEndpoint)
      },
      gasPrice: 30000000000,
      network_id: 42
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
