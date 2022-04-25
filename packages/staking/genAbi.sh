#!/bin/sh

rm -rf ABI/*

solc \
    -o ABI/ --overwrite \
    --abi contracts/*.sol \
    --allow-paths contracts/lib*.sol
