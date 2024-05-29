import { HardhatUserConfig } from "hardhat/types";
import { task } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

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
    fs.readFileSync("./test_account_keys.json", "ascii"),
  ).private_keys;
  const accounts = [];
  for (const addr in accountKeys) {
    accounts.push({
      privateKey: accountKeys[addr],
      balance: "1" + "0".repeat(24),
    });
  }

  return accounts;
}

export default {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      accounts: loadTestAccounts(),
    },

    optimistic: {
      chainId: 420,
      url: "http://127.0.0.1:8545",
      gas: 6700000,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
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
      accounts: loadTestAccounts().map((item) => item.privateKey),
    },

    goerli: {
      chainId: 5,
      url: "https://eth-goerli.g.alchemy.com/v2/Vf2BpEUqjAj4fV8pZ6hFXuyNLAFDb0s2",
      accounts: [process.env.PRIVATE_KEY],
    },
    ethereum: {
      chainId: 1,
      url: "https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03",
      accounts: [process.env.PRIVATE_KEY],
    },
    taiko: {
      chainId: 167000,
      url: "https://rpc.mainnet.taiko.xyz",
      loggingEnabled: true,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 10000000,
    },
    taiko2: {
      chainId: 167004,
      url: "https://l2rpc.a2.taiko.xyz/",
      accounts: [process.env.PRIVATE_KEY],
    },
    taiko7: {
      url: "https://rpc.hekla.taiko.xyz",
      accounts: [process.env.PRIVATE_KEY],
    },
    sepolia: {
      chainId: 11155111,
      url: "https://eth-sepolia.g.alchemy.com/v2/SNFvRbyJF_p1iea94S-Piy5fqNhALSVB",
      accounts: [process.env.PRIVATE_KEY],
    },

    bsctestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: loadTestAccounts().map((item) => item.privateKey),
    },
    arbitrum_goerli: {
      chainId: 421613,
      url: "https://endpoints.omniatech.io/v1/arbitrum/goerli/public",
      accounts: [process.env.PRIVATE_KEY],
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
        .map((item) => item.privateKey)
        .slice(),
    },

    arbitrum_one: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      timeout: 20000,
      httpHeaders: undefined,
      accounts: [],
    },
  },

  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
    },
  },

  gasReporter: {
    currency: "USD",
    gasPrice: 100,
  },

  etherscan: {
    // Your API key for Etherscan
    // apiKey: "1F73WEV5ZM2HKPIVCG65U5QQ427NPUG9FI",
    apiKey: "22PHXVHY72MJ1GFFYGV6P3T17XPYXR6BAG",
    customChains: [
      {
        network: "taiko",
        chainId: 167000,
        urls: {
          apiURL: "https://api.taikoscan.io/api", // https => http
          browserURL: "https://taikoscan.io",
        },
      },
    ],
  },
};
