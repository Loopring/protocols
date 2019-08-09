#!/bin/sh

rm -rf ABI/

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/thirdparty/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/lib/*.sol \
    --allow-paths contracts/thirdparty/*.sol

node_modules/solc/solcjs \
    -o ABI/version30/ --overwrite \
    --abi contracts/iface/*.sol \
    --allow-paths contracts/thirdparty/*.sol contracts/lib/*.sol

mv ABI/version30/contracts_iface_IAddressWhitelist_sol_IAddressWhitelist.abi ABI/version30/IAddressWhitelist.abi
mv ABI/version30/contracts_iface_IBlockVerifier_sol_IBlockVerifier.abi ABI/version30/IBlockVerifier.abi
mv ABI/version30/contracts_iface_IDecompressor_sol_IDecompressor.abi ABI/version30/IDecompressor.abi
mv ABI/version30/contracts_iface_IDowntimeCostCalculator_sol_IDowntimeCostCalculator.abi ABI/version30/IDowntimeCostCalculator.abi
mv ABI/version30/contracts_iface_IExchange_sol_IExchangeV3.abi ABI/version30/IExchangeV3.abi
mv ABI/version30/contracts_iface_ILoopringV3_sol_ILoopringV3.abi ABI/version30/ILoopringV3.abi
mv ABI/version30/contracts_iface_ILoopring_sol_ILoopring.abi ABI/version30/ILoopring.abi
mv ABI/version30/contracts_iface_IProtocolFeeVault_sol_IProtocolFeeVault.abi ABI/version30/IProtocolFeeVault.abi
mv ABI/version30/contracts_iface_IProtocolRegistry_sol_IProtocolRegistry.abi ABI/version30/IProtocolRegistry.abi
mv ABI/version30/contracts_iface_IUserStakingPool_sol_IUserStakingPool.abi ABI/version30/IUserStakingPool.abi
mv ABI/version30/contracts_lib_AddressUtil_sol_AddressUtil.abi ABI/version30/AddressUtil.abi
mv ABI/version30/contracts_lib_Authorizable_sol_Authorizable.abi ABI/version30/Authorizable.abi
mv ABI/version30/contracts_lib_BurnableERC20_sol_BurnableERC20.abi ABI/version30/BurnableERC20.abi
mv ABI/version30/contracts_lib_BytesUtil_sol_BytesUtil.abi ABI/version30/BytesUtil.abi
mv ABI/version30/contracts_lib_Claimable_sol_Claimable.abi ABI/version30/Claimable.abi
mv ABI/version30/contracts_lib_ERC20SafeTransfer_sol_ERC20SafeTransfer.abi ABI/version30/ERC20SafeTransfer.abi
mv ABI/version30/contracts_lib_ERC20Token_sol_ERC20Token.abi ABI/version30/ERC20Token.abi
mv ABI/version30/contracts_lib_ERC20_sol_ERC20.abi ABI/version30/ERC20.abi
mv ABI/version30/contracts_lib_Killable_sol_Killable.abi ABI/version30/Killable.abi
mv ABI/version30/contracts_lib_MathUint_sol_MathUint.abi ABI/version30/MathUint.abi
mv ABI/version30/contracts_lib_Ownable_sol_Ownable.abi ABI/version30/Ownable.abi
mv ABI/version30/contracts_lib_Poseidon_sol_Poseidon.abi ABI/version30/Poseidon.abi
mv ABI/version30/contracts_lib_ReentrancyGuard_sol_ReentrancyGuard.abi ABI/version30/ReentrancyGuard.abi
mv ABI/version30/contracts_thirdparty_BatchVerifier_sol_BatchVerifier.abi ABI/version30/BatchVerifier.abi
mv ABI/version30/contracts_thirdparty_OwnedUpgradabilityProxy_sol_OwnedUpgradabilityProxy.abi ABI/version30/OwnedUpgradabilityProxy.abi
mv ABI/version30/contracts_thirdparty_Proxy_sol_Proxy.abi ABI/version30/Proxy.abi
mv ABI/version30/contracts_thirdparty_UpgradeabilityProxy_sol_UpgradeabilityProxy.abi ABI/version30/UpgradeabilityProxy.abi
mv ABI/version30/contracts_thirdparty_Verifier_sol_Verifier.abi ABI/version30/Verifier.abi
