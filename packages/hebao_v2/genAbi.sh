#!/bin/bash

ABI_PATH="./ABI"
rm -rf $ABI_PATH
mkdir $ABI_PATH

if ! type "solc" > /dev/null; then
    case "$OSTYPE" in
        darwin*)
            echo "OS: MacOS"
            brew install ethereum/ethereum/solidity
            ;;

        linux*)
            echo "OS: Linux"
            sudo add-apt-repository ppa:ethereum/ethereum
            sudo apt-get update
            sudo apt-get install solc
            ;;

        *)
            echo "unsupported OS: $OSTYPE"
            exit 0
            ;;
    esac
fi


solc-0.7.6 \
    -o ABI/ --overwrite \
    --abi contracts/base/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol \
    contracts/base/*.sol contracts/price/*.sol contracts/iface/*.sol

# for file in $ABI_PATH/*
# do
#     mv $file "${file##*_}"
# done
