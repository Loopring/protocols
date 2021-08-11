import { HardhatUserConfig } from "hardhat/types";
import { task } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";

// import "@eth-optimism/plugins/hardhat/compiler";
// import "@eth-optimism/plugins/hardhat/ethers";

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

function loadTestAccounts() {
  const fs = require("fs");
  const accountKeys = JSON.parse(
    fs.readFileSync("./test_account_keys.json", "ascii")
  ).private_keys;
  const accounts = [];
  for (const addr in accountKeys) {
    accounts.push({
      privateKey: accountKeys[addr],
      balance: "1" + "0".repeat(24)
    });
  }

  return accounts;
}

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: loadTestAccounts()
    },

    // HttpNetworkConfig
    ganache: {
      chainId: 31337,
      url: "http://localhost:8545",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 20000,
      httpHeaders: undefined,
      accounts: loadTestAccounts().map(item => item.privateKey)
    },

    goerli: {
      chainId: 5,
      url: "https://goerli.infura.io/v3/b7c22d73c16e4c0ea3f88dadbdffbe03",
      gas: 7000000,
      gasPrice: 11e9,
      gasMultiplier: 1,
      timeout: 20000,
      httpHeaders: undefined,
      accounts: loadTestAccounts().map(item => item.privateKey)
    },

    bsctestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: loadTestAccounts().map(item => item.privateKey)
    },

    arbitrum_test: {
      chainId: 421611,
      url: "https://rinkeby.arbitrum.io/rpc",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 60000,
      httpHeaders: undefined,
      accounts: loadTestAccounts()
        .map(item => item.privateKey)
        .slice()
    },

    arbitrum_one: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 20000,
      httpHeaders: undefined,
      accounts: []
    }
  },

  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000
      }
    }
  },

  gasReporter: {
    currency: "USD",
    gasPrice: 100
  },

  etherscan: {
    // Your API key for Etherscan
    apiKey: "1F73WEV5ZM2HKPIVCG65U5QQ427NPUG9FI"
  }
};
