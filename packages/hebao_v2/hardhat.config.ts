import { HardhatUserConfig } from "hardhat/types";
import { task } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";

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

// loadTestAccounts();

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

    arbitrum: {
      chainId: 212984383488152,
      url: "https://kovan4.arbitrum.io/rpc",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 20000,
      httpHeaders: undefined,
      accounts: loadTestAccounts()
        .map(item => item.privateKey)
        .slice()
    }
  },

  solidity: "0.7.6",

  gasReporter: {
    currency: "USD",
    gasPrice: 100
  }
};
