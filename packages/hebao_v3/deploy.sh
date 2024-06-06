#!/bin/bash
#
NETWORK=sepolia

VERSION="SmartWalletV3_2"

# rm -rf deployments/${NETWORK}

# 1. connector registry
# yarn hardhat connector-registry deploy --network ${NETWORK}

# # 2. entry point
# yarn hardhat entrypoint deploy --network ${NETWORK}

# 3. deploy smart wallet and create a demo wallet
yarn hardhat smart-wallet deploy --version-name ${VERSION} --network ${NETWORK}

# 4. paymaster
# yarn hardhat paymaster deploy --network ${NETWORK}

# # 5. deploy some mock tokens for test
# yarn hardhat token deploy --tokens "USDT,LRC" --network ${NETWORK}

# # 6. register token in paymaster
# yarn hardhat paymaster register-token --tokens "USDT,LRC" --network ${NETWORK}
