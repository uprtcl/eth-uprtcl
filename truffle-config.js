require('dotenv').config();
const PrivateKeyProvider = require('truffle-privatekey-provider');

module.exports = {

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    rinkeby: {
      provider: () => {
        return new PrivateKeyProvider(
          process.env.PRIVATE_KEY, 
          process.env.RPC_ENDPOINT
        );
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
