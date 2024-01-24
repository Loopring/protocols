import '@nomicfoundation/hardhat-chai-matchers'
import '@nomiclabs/hardhat-ethers'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import { type HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-verify'

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
              // url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
              url: 'https://eth-mainnet.g.alchemy.com/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03',
              blockNumber: 18482580
            }
          : undefined
    },
    ethereum: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [privateKey]
    },

    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
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
    taiko6: {
      url: 'https://rpc.katla.taiko.xyz/',
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 2000000000
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
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
