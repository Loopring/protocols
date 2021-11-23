#!/bin/sh

#yarn truffle deploy --reset  --network $NETWORK
yarn truffle deploy --network $NETWORK
truffle run verify CounterfactualNFT --network $NETWORK

