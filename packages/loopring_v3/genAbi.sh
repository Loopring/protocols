#!/bin/sh

rm -rf ABI/

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/thirdparty/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/lib/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/iface/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/iface/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol

ABI_PATH="ABI/version30"

for file in $ABI_PATH/*
do
    rename_file=$(echo $file | awk '{split($0,a,"_"); print a[5]}')
    mv $file $ABI_PATH/$rename_file
done

