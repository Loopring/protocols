#!/bin/bash

TRUFFLE_CMD="./node_modules/.bin/truffle"
declare -a ALL_CONTRACTS=(Cloneable \
			  BatchVerifier \
			  UniversalRegistry \
			  DowntimeCostCalculator \
			  ProtocolFeeVault \
			  UniswapTokenSeller \
			  UserStakingPool \
			  BlockVerifier \
			  ExchangeConstants \
			  ExchangeAccounts \
			  ExchangeAdmins \
			  ExchangeBalances \
			  ExchangeBlocks \
			  ExchangeDeposits \
			  ExchangeGenesis \
			  ExchangeTokens \
			  ExchangeWithdrawals \
			  ExchangeV3 \
			  LoopringV3\
			 )

for contract in "${ALL_CONTRACTS[@]}"
do
    $TRUFFLE_CMD run verify "$contract" --network live
done

echo "All contracts verified!"

