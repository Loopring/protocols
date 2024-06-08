#!/bin/bash
#
NETWORK=sepolia

# smart wallet name
RECEIVER=smartWallet
PAYMASTER=LoopringPaymaster
GUARDIAN=0x456ecAca6A1Bc3a71fC1955562d1d9BF662974D8
NEW_IMPL=SmartWalletV3

# create a demo wallet
# yarn hardhat smart-wallet create --name ${RECEIVER} --impl ${NEW_IMPL} --network ${NETWORK}
# add guardian
# yarn hardhat smart-wallet add-guardians --name ${RECEIVER} --guardians ${GUARDIAN} --network ${NETWORK}

# deposit eth to entrypoint
# yarn hardhat entrypoint deposit --amount "0.1" --receiver ${RECEIVER} --network ${NETWORK}
# # for paymaster
# yarn hardhat entrypoint deposit --amount "0.1" --receiver ${PAYMASTER} --network ${NETWORK}

# # mint tokens to smart wallet
# yarn hardhat token mint --token "USDT" --receiver ${RECEIVER} --network ${NETWORK}
# # mint tokens to deployer
# yarn hardhat token mint --token "USDT" --amount "1000000" --network ${NETWORK}

# # deposit token to paymaster for wallet
# yarn hardhat paymaster deposit-token --token "USDT" --amount "10000" --receiver ${RECEIVER} --network ${NETWORK}

# upgrade to new implementation
yarn hardhat smart-wallet upgrade-impl --name ${RECEIVER} --impl ${NEW_IMPL} --network ${NETWORK}
