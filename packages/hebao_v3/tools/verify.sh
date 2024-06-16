#!/bin/bash
#
#
NETWORK=sepolia

VERSION="SmartWalletV3"

yarn hardhat connector-registry verify --network ${NETWORK}

yarn hardhat entrypoint verify --network ${NETWORK}

yarn hardhat smart-wallet verify --version-name ${VERSION} --network ${NETWORK}

yarn hardhat paymaster verify --network ${NETWORK}

yarn hardhat token verify --tokens "USDT,LRC" --network ${NETWORK}
