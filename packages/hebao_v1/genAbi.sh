#!/bin/sh

ABI_PATH="./ABI"
rm -rf $ABI_PATH
mkdir $ABI_PATH

solc \
    -o ABI/ --overwrite \
    --abi contracts/thirdparty/*.sol

solc \
    -o ABI/ --overwrite \
    --abi contracts/lib/*.sol \
    --allow-paths contracts/thirdparty/*.sol

solc \
    -o ABI/ --overwrite \
    --abi contracts/iface/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol \
    contracts/base/*.sol contracts/stores/*.sol

solc \
    -o ABI/ --overwrite \
    --abi contracts/base/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol \
    contracts/iface/*.sol contracts/stores/*.sol

# for file in $ABI_PATH/*
# do
#     mv $file "${file##*_}"
# done
