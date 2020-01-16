#!/bin/sh

ABI_PATH="./ABI"
rm -rf $ABI_PATH
mkdir $ABI_PATH

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

solc \
    -o ABI/ --overwrite \
    --abi contracts/modules/core/*.sol \
    contracts/modules/dapps/*.sol contracts/modules/exchanges/*.sol \
    contracts/modules/transfers/*.sol contracts/modules/security/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol \
    contracts/iface/*.sol contracts/stores/*.sol \
    contracts/base/*.sol contracts/modules/security/*.sol \

# for file in $ABI_PATH/*
# do
#     mv $file "${file##*_}"
# done
