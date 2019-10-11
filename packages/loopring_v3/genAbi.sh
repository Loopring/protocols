#!/bin/sh

rm -rf ABI/

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/thirdparty/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/lib/*.sol \
    --allow-paths contracts/thirdparty/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/iface/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/test/DummyToken.sol \
    --allow-paths contracts/test/*.sol contracts/lib/*.sol contracts/thirdparty/*.sol contracts/iface/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/impl/libexchange/ExchangeConstants.sol \
    contracts/impl/libexchange/ExchangeData.sol \
    --allow-paths contracts/iface/*.sol contracts/lib/*.sol contracts/thirdparty/*.sol

ABI_PATH="ABI/version30"

for file in $ABI_PATH/*
do
    mv $file $ABI_PATH/"${file##*_}"
done

