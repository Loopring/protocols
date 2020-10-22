#!/bin/bash

SOLC_CMD="../../node_modules/.bin/solcjs"
BASE_PATH="../../contracts/"
BUILD_DEST="build"

declare -a all_contracts=(
    "base/ModuleRegistryImpl.sol"
    "stores/DappAddressStore.sol"
    "stores/HashStore.sol"
    "stores/NonceStore.sol"
    "stores/QuotaStore.sol"
    "stores/SecurityStore.sol"
    "stores/WhitelistStore.sol"
    "modules/ControllerImpl.sol"
    "modules/OfficialGuardian.sol"
    "modules/WalletImpl.sol"
    "modules/core/WalletFactory.sol"
    "modules/core/ERC1271Module.sol"
    "modules/core/ForwarderModule.sol"
    "modules/core/UpgraderModule.sol"
    "modules/security/SignedRequest.sol"
    "modules/security/WhitelistModule.sol"
    "modules/security/InheritanceModule.sol"
    "modules/security/GuardianModule.sol"
    "modules/transfers/TransferModule.sol"
    "thirdparty/ens/BaseENSManager.sol"
    "thirdparty/ens/BaseENSResolver.sol"
    "thirdparty/ens/ENSRegistryImpl.sol"
    "thirdparty/ens/ENSReverseRegistrarImpl.sol"
    "test/tokens/LRC.sol"
    "test/tokens/USDT.sol"
)

mkdir -p $BUILD_DEST

echo "solc version: `$SOLC_CMD --version`"
for contract in "${all_contracts[@]}"
do
    contract_full_path=$BASE_PATH$contract
    echo "generating abi file for $contract_full_path ..."
    $SOLC_CMD -o $BUILD_DEST --base-path $BASE_PATH --abi $contract_full_path
    echo "generating binary file for $contract_full_path ..."
    $SOLC_CMD -o $BUILD_DEST --base-path $BASE_PATH --optimize --bin $contract_full_path
done

echo "done"
