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

function generateForkInfo(
  chainId: string | undefined,
  apiKey: string | undefined
): { url: string; blockNumber: number } | undefined {
  if (chainId === undefined || apiKey === undefined) {
    return undefined
  }
  switch (parseInt(chainId)) {
    case 1: {
      // mainnet
      return {
        url: `https://mainnet.infura.io/v3/${apiKey}`,
        blockNumber: 18482580
      }
    }
    case 11155111: {
      // sepolia
      return {
        url: `https://sepolia.infura.io/v3/${apiKey}`,
        blockNumber: 5563000
      }
    }
    default: {
      throw new Error(`unknown chainId: ${chainId}`)
    }
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: generateForkInfo(
        process.env.FORK,
        process.env.INFURA_API_KEY
      )
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
      url: 'https://rpc.mainnet.taiko.xyz',
      accounts: [privateKey],
      gasPrice: 10000000
    },
    taiko2: {
      url: 'https://l2rpc.a2.taiko.xyz/',
      accounts: [privateKey]
    },
    taiko6: {
      url: 'https://rpc.katla.taiko.xyz/',
      accounts: [process.env.PRIVATE_KEY as string],
      gasPrice: 2000000000
    },
    taiko7: {
      url: 'https://rpc.hekla.taiko.xyz',
      accounts: [process.env.PRIVATE_KEY as string],
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
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.7.6',
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
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: 'taiko',
        chainId: 167000,
        urls: {
          apiURL: 'https://api.taikoscan.io/api',
          browserURL: 'https://taikoscan.io'
        }
      }
    ]
  }
}

export default config
