import 'hardhat-gas-reporter'
import '@nomicfoundation/hardhat-toolbox'
import { type HardhatUserConfig } from 'hardhat/config'

import * as dotenv from 'dotenv'

dotenv.config()

const privateKey = process.env.PRIVATE_KEY as string

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking:
        process.env.FORK != null
          ? {
              url: 'https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03',
              blockNumber: 18482580
            }
          : undefined
    },
    ethereum: {
      url: 'https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03',
      accounts: [privateKey]
    },

    goerli: {
      url: 'https://goerli.infura.io/v3/b7c22d73c16e4c0ea3f88dadbdffbe03',
      accounts: [privateKey]
    },

    taiko: {
      url: 'https://l2rpc.hackathon.taiko.xyz',
      accounts: [privateKey]
    },
    taiko2: {
      url: 'https://l2rpc.a2.taiko.xyz/',
      accounts: [privateKey]
    },
    sepolia: {
      url: 'https://eth-sepolia.g.alchemy.com/v2/SNFvRbyJF_p1iea94S-Piy5fqNhALSVB',
      accounts: [privateKey]
    },

    bsctestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: [privateKey]
    },

    arbitrum_test: {
      url: 'https://rinkeby.arbitrum.io/rpc',
      accounts: [privateKey]
    },

    arbitrum_one: {
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: [privateKey]
    }
  },

  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  gasReporter: {
    currency: 'USD',
    gasPrice: 100
  },

  etherscan: {
    // Your API key for Etherscan
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

export default config
