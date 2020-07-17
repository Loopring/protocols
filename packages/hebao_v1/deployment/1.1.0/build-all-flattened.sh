#!/bin/bash

OUT_DIR="build"

if [ "$#" -ne 1 ] || ! [ -d "$1" ]; then
  echo "Usage: $0 DIRECTORY" >&2
  exit 1
fi

echo "build all flattened contracts in dir $1 ..."

cd $1

SOLC_COMMAND="../../../node_modules/.bin/solcjs"

for contract in ./*; do
    echo "generate abi for $contract ..."
    $SOLC_COMMAND --abi $contract -o $OUT_DIR
    echo "generate binary for $contract ..."
    $SOLC_COMMAND --optimize --bin $contract -o $OUT_DIR
done

mv $OUT_DIR ../
