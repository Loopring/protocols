// var dotenv  = require('dotenv').config();
var fs = require("fs");
var HDWalletProvider = require("truffle-hdwallet-provider");
var PrivateKeyProvider = require("truffle-privatekey-provider");

// config the following
const etherscanAPIKeyPath =
  process.env.HOME + "/.protocolv3_migration_etherscan_key";
const walletFile = process.env.HOME + "/.protocolv3_migration_wallet";
const infuraProjectId = "f6a06b14054b4f4880e002a191492c49";
const usePrivateKey = true; // false for using mnemonic.

const getWalletProvider = function(network) {
  var content = fs.readFileSync(walletFile, "utf8");

  var infuraAPI = "https://" + network + ".infura.io/v3/" + infuraProjectId;
  var provider;
  if (usePrivateKey == true) {
    provider = new PrivateKeyProvider(content, infuraAPI);
  } else {
    provider = new HDWalletProvider(content, infuraAPI);
  }
  return provider;
};

const getEtherScanAPIKey = function() {
  return fs.readFileSync(etherscanAPIKeyPath, "utf8");
};

module.exports = {
  compilers: {
    solc: {
      settings: {
        optimizer: {
          enabled: true,
          runs: 100
        }
      },
      version: "0.5.10"
    }
  },
  plugins: ["truffle-plugin-verify"],
  api_keys: {
    etherscan: getEtherScanAPIKey()
  },
  networks: {
    live: {
      provider: function() {
        return getWalletProvider("mainnet");
      },
      network_id: "1", // main-net
      gasPrice: 5000000000
    },
    testnet: {
      host: "localhost",
      port: 8545,
      network_id: "2", // main-net
      gasPrice: 21000000000
    },
    ropsten: {
      network_id: 3,
      provider: function() {
        return getWalletProvider("ropsten");
      },
      gasPrice: 1000000000,
      gas: 6700000
    },
    rinkeby: {
      network_id: 4,
      provider: function() {
        return getWalletProvider("rinkeby");
      },
      gasPrice: 1000000000,
      gas: 6700000
    },
    priv: {
      host: "localhost",
      port: 8545,
      network_id: "50", // main-net
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
      port: 8555, // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01 // <-- Use this low gas price
    },
    docker: {
      host: "ganache",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 21000000000,
      gas: 6700000
    }
  },
  test_directory: "transpiled/test",
  migrations_directory: "transpiled/migrations"
};
