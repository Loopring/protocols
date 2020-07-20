#!/bin/bash

if [ "$#" -ne 1 ] || ! [ -d "$1" ]; then
  echo "Usage: $0 DIRECTORY" >&2
  exit 1
fi

OUT_DIR="$1/build"

mkdir -p $OUT_DIR

rm $OUT_DIR/*

echo "build all flattened contracts in dir $1/flattened ..."

##cd $1

SOLC_COMMAND="../node_modules/.bin/solcjs"

for contract in $1/flattened/*; do
    echo "generate abi for $contract ..."
    $SOLC_COMMAND -o $OUT_DIR --abi $contract
    echo "generate binary for $contract ..."
    $SOLC_COMMAND -o $OUT_DIR --optimize --bin $contract
done

# mv $OUT_DIR ../
