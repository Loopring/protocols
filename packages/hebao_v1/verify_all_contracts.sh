#!/bin/bash

TRUFFLE_CMD="./node_modules/.bin/truffle"
declare -a ALL_CONTRACTS=( \
              # WalletENSManager \
              # BaseENSResolver \
              # ENSRegistryImpl \
              # ENSReverseRegistrarImpl \
              # WalletRegistryImpl \
              # ModuleRegistryImpl \
              # QuotaStore \
              # SecurityStore \
              # WhitelistStore \
              # PriceCacheStore \
              ControllerImpl@0x43F14319a5c5d88E37D7c4b6dA9EFD4E8718a153 \
              BaseWallet \
              WalletFactoryModule \
              GuardianModule \
              RecoveryModule \
              LockModule \
              InheritanceModule@0xf973F74617EF97c054dbe2b4D0f86fA57Ed6c820 \
              WhitelistModule \
              QuotaModule \
              QuotaTransfers \
              ApprovedTransfers \
              # ERC1271Module \
              DappAddressStore \
              DappTransfers \
             )

for contract in "${ALL_CONTRACTS[@]}"
do
    $TRUFFLE_CMD run verify "$contract" --network live
done

echo "All contracts verified!"
