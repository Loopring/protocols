#!/bin/bash

FLATTER_COMMAND="../../node_modules/.bin/truffle-flattener"
DEST="flattened"

SPDX_FILTER="SPDX-License-Identifier"
SPDX_LINE="// SPDX-License-Identifier: Apache-2.0"
PRAGMA_SOL_FILTER="pragma solidity"
PRAGMA_SOL_LINE="pragma solidity ^0.6.10;"
PRAGMA_EXPR_FILTER="pragma experimental"
PRAGMA_EXPR_LINE="pragma experimental ABIEncoderV2;"

declare -a all_contracts=(
    "contracts/base/WalletRegistryImpl.sol"
    "contracts/base/ModuleRegistryImpl.sol"
    "contracts/stores/DappAddressStore.sol"
    "contracts/stores/HashStore.sol"
    "contracts/stores/NonceStore.sol"
    "contracts/stores/QuotaStore.sol"
    "contracts/stores/SecurityStore.sol"
    "contracts/stores/WhitelistStore.sol"
    "contracts/modules/ControllerImpl.sol"
    "contracts/modules/OfficialGuardian.sol"
    "contracts/modules/WalletImpl.sol"
    "contracts/modules/core/WalletFactory.sol"
    "contracts/modules/core/ERC1271Module.sol"
    "contracts/modules/core/ForwarderModule.sol"
    "contracts/modules/core/UpgraderModule.sol"
    "contracts/modules/security/SignedRequest.sol"
    "contracts/modules/security/WhitelistModule.sol"
    "contracts/modules/security/InheritanceModule.sol"
    "contracts/modules/security/GuardianModule.sol"
    "contracts/modules/transfers/TransferModule.sol"
    "contracts/thirdparty/ens/BaseENSManager.sol"
    "contracts/thirdparty/ens/BaseENSResolver.sol"
    "contracts/thirdparty/ens/ENSRegistryImpl.sol"
    "contracts/thirdparty/ens/ENSReverseRegistrarImpl.sol"
    "contracts/test/tokens/LRC.sol"
    "contracts/test/tokens/USDT.sol"
)

mkdir -p $DEST

for contract in "${all_contracts[@]}"
do
    file_name=`basename $contract .sol`
    echo "flattening ${contract} ..."
    dest_file="$DEST/${file_name}_flat.sol"
    $FLATTER_COMMAND "../../$contract" \
        | grep -v "$SPDX_FILTER" \
        | grep -v "$PRAGMA_SOL_FILTER" > $dest_file

    headers="$SPDX_LINE\n$PRAGMA_SOL_LINE"
    if grep -q "$PRAGMA_EXPR_FILTER" $dest_file; then
        headers="$headers\n$PRAGMA_EXPR_LINE"
        cat $dest_file | grep -v "$PRAGMA_EXPR_FILTER" > "${dest_file}.tmp0" && mv "${dest_file}.tmp0" $dest_file
    fi

    (echo -e "$headers" && cat $dest_file ) > "${dest_file}.tmp" && mv "${dest_file}.tmp" $dest_file

    echo "${file_name}.sol successfully flattened, saved to ${dest_file}"
done
