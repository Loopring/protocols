#!/bin/sh

solc --abi contracts/iface/*.sol --allow-paths contracts/**/*.sol -o ABI/version10/ --overwrite

solc --abi contracts/lib/*.sol --allow-paths contracts/**/*.sol -o ABI/version10/ --overwrite
