import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";

dotenv.config();

export default {
  defaultNetwork: "hardhat",
  networks: {
    ethereum: {
      chainId: 1,
      url: "https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03",
      accounts: [process.env.PRIVATE_KEY],
    },

    goerli: {
      chainId: 5,
      url: "https://goerli.infura.io/v3/b7c22d73c16e4c0ea3f88dadbdffbe03",
      accounts: [process.env.PRIVATE_KEY],
    },

    taiko: {
      url: "https://l2rpc.hackathon.taiko.xyz",
      accounts: [process.env.PRIVATE_KEY],
    },
    taiko2: {
      url: "https://l2rpc.a2.taiko.xyz/",
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
      accounts: [process.env.PRIVATE_KEY],
    },

    arbitrum_test: {
      chainId: 421611,
      url: "https://rinkeby.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },

    arbitrum_one: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },

  gasReporter: {
    currency: "USD",
    gasPrice: 100,
  },

  etherscan: {
    // Your API key for Etherscan
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
