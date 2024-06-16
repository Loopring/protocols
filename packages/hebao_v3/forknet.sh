#!/bin/bash
NETWORK=sepolia
BLOCK_HEIGHT=5852921

# NETWORK=mainnet
# BLOCK_HEIGHT=19887026

RPC_URL=https://${NETWORK}.infura.io/v3/3d3d74e182d84833b56c1382b63691eb
yarn hardhat node --fork ${RPC_URL}
