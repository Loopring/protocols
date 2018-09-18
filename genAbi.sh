#!/bin/sh

solc --abi contracts/iface/*.sol -o ABI/version20/
solc --abi contracts/lib/*.sol -o ABI/version20/
