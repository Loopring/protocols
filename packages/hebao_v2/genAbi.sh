#!/bin/sh

rm -rf ABI/*

solc \
    -o ABI/ --overwrite \
    --abi contracts/base/*.sol \
    --allow-paths contracts/base/libwallet/*.sol contracts/thirdparty/proxies/*.sol contracts/thirdparty/*.sol contracts/lib/*.sol contracts/iface/*.sol

ABI_PATH="ABI"

for file in $ABI_PATH/*
do
    rename_file=$(echo $file | awk '{n=split($0,a,"_"); print a[n]}')
    mv $file $rename_file
done
