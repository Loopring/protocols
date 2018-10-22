var fs = require("fs");
var HDWalletProvider = require("truffle-hdwallet-provider");

// var mnemonic = fs.readFileSync(process.env.HOME + "/priv/mnemonic.txt", "utf8");
// console.log("mnemonic", mnemonic);

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 10000
    }
  },
  networks: {
    live: {
      host: "localhost",
      port: 8546,
      network_id: '1', // main-net
      gasPrice: 5000000000
    },
    testnet: {
      host: "localhost",
      port: 8545,
      network_id: '2', // main-net
      gasPrice: 21000000000
    },
    ropsten: {
      network_id: 3,
      provider: function() {
        var provider = new HDWalletProvider(mnemonic, "https://ropsten.infura.io/hM4sFGiBdqbnGTxk5YT2", 1);
        // console.log("addresses:", provider.getAddresses());
        return provider;
      },
      gasPrice: 21000000000
    },
    rinkeby: {
      network_id: 4,
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/hM4sFGiBdqbnGTxk5YT2", 1);
      },
      gasPrice: 21000000000
    },
    priv: {
      host: "localhost",
      port: 8545,
      network_id: '50', // main-net
      gasPrice: 5000000000,
      gas: 4500000
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 21000000000,
      gas: 6700000
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,         // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01      // <-- Use this low gas price
    },
    docker: {
      host: "ganache",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 21000000000,
      gas: 6700000
    }
  },
  test_directory: 'transpiled/test',
  migrations_directory: 'transpiled/migrations',
};
