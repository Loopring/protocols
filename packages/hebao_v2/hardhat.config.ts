import { HardhatUserConfig } from "hardhat/types";
import { task } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
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

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: loadTestAccounts()
    }
  },

  solidity: "0.7.6"
};

export default config;
