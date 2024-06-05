#!/bin/bash
#
NETWORK=sepolia

# smart wallet name
RECEIVER=smartWallet
PAYMASTER=LoopringPaymaster

# create a demo wallet
yarn hardhat smart-wallet create --name ${RECEIVER} --network ${NETWORK}


# deposit eth to entrypoint
yarn hardhat entrypoint deposit --amount "0.01" --receiver ${RECEIVER} --network ${NETWORK}
# for paymaster
yarn hardhat entrypoint deposit --amount "0.01" --receiver ${PAYMASTER} --network ${NETWORK}

# mint tokens to smart wallet
yarn hardhat token mint --token "USDT" --receiver ${RECEIVER} --network ${NETWORK}
# mint tokens to deployer
yarn hardhat token mint --token "USDT" --amount "1000000" --network ${NETWORK}

# deposit token to paymaster for wallet
yarn hardhat paymaster deposit-token --token "USDT" --amount "10000" --receiver ${RECEIVER} --network ${NETWORK}
