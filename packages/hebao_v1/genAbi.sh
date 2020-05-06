#!/bin/sh

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


solc \
    -o ABI/ --overwrite \
    --abi contracts/iface/*.sol
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
