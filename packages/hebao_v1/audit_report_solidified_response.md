## ABOUT

This document contains our response to the audit report from Solidified.

## STATUS

A work in progress.

## Response

### 1. BaseVault.execute(..) transactions can be replayed.

Addressed by PR https://github.com/Loopring/protocols/pull/1185

### 2. Reentrancy vulnerability in MetaTxModule.sol, function executeTransactions()

Addressed by PR https://github.com/Loopring/protocols/pull/1188

### 3. Mathint.sol does not prevent underflow/overflow.

Addressed by PR https://github.com/Loopring/protocols/pull/1181

### 4. Deployer key holds a vast amount of power.

We will manage the admin account using a two-layer solution. The first layer is a third-party multisig wallet, and the controlling keys are cold. This multisig wallet will NOT directly manage our contracts but will maintain a list of _managers_ who will directly manage the contracts.

The multisig wallet thus is not considered to be part of the Hebao smart contract codebase.

### 5. MetaTxModule.sol: Transactions without nonce are allowed

### 6. MathUint.decodeFloat() does not revert on overflow

Addressed by PR https://github.com/Loopring/protocols/pull/1182

### 7. Guardian and owner could be the same address

Addressed by PR https://github.com/Loopring/protocols/pull/1187

### 8. MetaTxModule.sol: Relayer can cause transactions to fail by sending just above the limit the user provided.

Addressed by PR https://github.com/Loopring/protocols/pull/1186

### 9. CompoundModule.sol and Inheritance: Deposits and withdraws to Compound and change of Inheritance settings are allowed with a locked wallet.

### 10. BaseSubAccount.sol: Function canDepositToken currently returning withdrawable amount.

### 11. BaseSubAccount.sol: Functions TokenReturnAmount and tokenWithdrawable do not implement functionality for ETH.

### 12. ModuleRegistry.sol: Contract is owned by only one address.

See issue# 4 for the same solution.

### 13. Consider using Uniswap V2 price oracle

### 14. Attacks by malicious guardians

### 15. Dapp Modules can bypass quotas and whitelists

Dapps that are whitelisted will bypass quotas **by design**. One principle we have is only to whitelist dapps that transfer Ether/token back to the original user address.
We are removing Dapps modules, and adding a new `DappModule`to interact with whitelisted dapps. https://github.com/Loopring/protocols/pull/1189 and https://github.com/Loopring/protocols/pull/1184

### 16. Vault can have more than MAX_OWNER owners

Addressed in PR https://github.com/Loopring/protocols/pull/1185 and https://github.com/Loopring/protocols/pull/1184

### 17. MetaTxModule.sol, ApprovedTransfers.sol: Return value of operations in collectTokens and reimburseGasFee is not being verified

Addressed in PR https://github.com/Loopring/protocols/pull/1189 and https://github.com/Loopring/protocols/pull/1184


### 18. The initialization method initManager() could be front-run, unless it is called within the same transaction as the creation of the contract.

Addressed by PR https://github.com/Loopring/protocols/pull/1194
