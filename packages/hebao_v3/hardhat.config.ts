import 'hardhat-gas-reporter'
import '@nomicfoundation/hardhat-toolbox'
import { HardhatUserConfig } from 'hardhat/config'

import * as dotenv from 'dotenv'

dotenv.config()

const privateKey = process.env.PRIVATE_KEY as string

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: [{ privateKey, balance: '10000000000000000000000' }]
    },
    ethereum: {
      chainId: 1,
      url: 'https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03',
      accounts: [privateKey]
    },

    goerli: {
      chainId: 5,
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
      chainId: 11155111,
      url: 'https://eth-sepolia.g.alchemy.com/v2/SNFvRbyJF_p1iea94S-Piy5fqNhALSVB',
      accounts: [privateKey]
    },

    bsctestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      accounts: [privateKey]
    },

    arbitrum_test: {
      chainId: 421611,
      url: 'https://rinkeby.arbitrum.io/rpc',
      accounts: [privateKey]
    },

    arbitrum_one: {
      chainId: 42161,
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: [privateKey]
    }
  },

  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
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
