var fs = require("fs");
var HDWalletProvider = require("truffle-hdwallet-provider");
var PrivateKeyProvider = require("truffle-privatekey-provider");
var mnemonic = "your mnemonic phases here.";
// or you may read your mnemonic phases from a file:
// var mnemonic = fs.readFileSync(process.env.HOME + "/priv/mnemonic.txt", "utf8");
// console.log("mnemonic", mnemonic);

module.exports = {
  compilers: {
    solc: {
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000
        },
        evmVersion: 'constantinople',
      },
      version: "0.5.7"
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
        // my address: 0xe8c5366C6f9Dc800cae753804CCbf1B6Ffa666fa
        return provider;
      },
      gasPrice: 21000000000
    },
    rinkeby: {
      network_id: 4,
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/hM4sFGiBdqbnGTxk5YT2", 1);
      },
      gasPrice: 1000000000,
      gas: 6700000
    },
    kovan: {
      provider: () => new PrivateKeyProvider("7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf", "https://kovan.infura.io/hM4sFGiBdqbnGTxk5YT2"),
      network_id: "*",
      gasPrice: 5000000000, // 50 gwei,
      gas: 6700000
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
