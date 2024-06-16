#!/bin/bash
#

NETWORK=sepolia

VERSION="SmartWalletV3"
SMART_WALLET="smartWallet"

yarn hardhat compile
yarn hardhat smart-wallet deploy --version-name ${VERSION} --network ${NETWORK}
yarn hardhat smart-wallet upgrade-impl --name ${SMART_WALLET} --impl ${VERSION} --network ${NETWORK}
