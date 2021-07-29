#!/bin/sh

rm -rf ABI/*

solc \
    -o ABI/ --overwrite \
    --optimize \
    --abi contracts/base/*.sol \
    --allow-paths contracts/base/libwallet/*.sol contracts/thirdparty/proxies/*.sol contracts/thirdparty/*.sol contracts/lib/*.sol contracts/iface/*.sol

