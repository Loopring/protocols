var fs = require("fs");
var HDWalletProvider = require("truffle-hdwallet-provider");
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
        }
      },
      version: "0.5.7"
    }
  },

  networks: {
    rinkeby: {
      network_id: 4,
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/hM4sFGiBdqbnGTxk5YT2", 1);
      },
      gasPrice: 1000000000,
      gas: 6700000
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 21000000000,
      gas: 6700000
    },
  }
};
