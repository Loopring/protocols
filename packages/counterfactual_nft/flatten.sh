#!/bin/bash

FLATTER_COMMAND="./node_modules/.bin/truffle-flattener"

SPDX_FILTER="SPDX-License-Identifier"
SPDX_LINE="// SPDX-License-Identifier: Apache-2.0"

declare -a all_contracts=(
    "contracts/CounterfactualNftExt.sol"
    "contracts/NFTFactory.sol"
)

DEST="flattened"
mkdir -p $DEST

for contract in "${all_contracts[@]}"
do
    file_name=`basename $contract .sol`
    echo "flattening ${contract} ..."
    dest_file="$DEST/${file_name}_flat.sol"
    $FLATTER_COMMAND "../$contract" \
        | grep -v "$SPDX_FILTER" > $dest_file

    echo "${file_name}.sol successfully flattened, saved to ${dest_file}"
done
