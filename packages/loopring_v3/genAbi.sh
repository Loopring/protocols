#!/bin/sh

solc --abi contracts/iface/*.sol -o ABI/version30/ --overwrite

solc --abi contracts/lib/*.sol --allow-paths contracts/iface/*.sol -o ABI/version30/ --overwrite