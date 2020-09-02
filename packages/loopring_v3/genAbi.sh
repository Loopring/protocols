#!/bin/sh

rm -rf ABI/*

node_modules/solc/solcjs \
    -o ABI/version36/ --overwrite \
    --abi contracts/core/iface/*.sol \
    --allow-paths contracts/thirdparty/proxies/*.sol contracts/thirdparty/*.sol contracts/lib/*.sol

ABI_PATH="ABI/version36"

for file in $ABI_PATH/*
do
    rename_file=$(echo $file | awk '{n=split($0,a,"_"); print a[n]}')
    mv $file $ABI_PATH/$rename_file
done
