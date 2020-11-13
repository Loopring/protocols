# Circuit documentation

## Constants

- NUM_BITS_ADDRESS := 160
- NUM_BITS_ACCOUNTID := 32
- NUM_BITS_TOKENID := 16
- NUM_BITS_AMOUNT := 96
- NUM_BITS_TIMESTAMP := 32
- NUM_BITS_NONCE := 32
- NUM_BITS_DA := 68\*8
- NUM_BITS_AMM_BIPS = 8
- NUM_BITS_HASH = 160
- NUM_BITS_STORAGEID = 32
- NUM_BITS_TYPE = 8
- NUM_BITS_TX_TYPE = 8

- TX_DATA_AVAILABILITY_SIZE = 68

- EMPTY_STORAGE_ROOT = 6592749167578234498153410564243369229486412054742481069049239297514590357090

- TREE_DEPTH_STORAGE = 14

- TransactionType.Noop := 0 (8 bits)
- TransactionType.Deposit := 1 (8 bits)
- TransactionType.Withdrawal := 2 (8 bits)
- TransactionType.Transfer := 3 (8 bits)
- TransactionType.SpotTrade := 4 (8 bits)
- TransactionType.AccountUpdate := 5 (8 bits)
- TransactionType.AmmUpdate := 6 (8 bits)

- Float24Encoding: Accuracy = {5, 19}
- Float16Encoding: Accuracy = {5, 11}

- JubJub.a := 168700
- JubJub.d := 168696
- JubJub.A := 168698

## Data types

- F: Snark field element
- Storage := (data: F, storageID: F)
- Balance := (balance: F, weightAMM: F, storageRoot: F)
- Account := (owner: F, publicKeyX: F, publicKeyY: F, nonce: F, feeBipsAMM: F, balancesRoot: F)

- Accuracy := (N: unsigned int, D: unsigned int)

- TxOutput := (
  STORAGE_A_ADDRESS: F (bits),
  STORAGE_A_DATA: F,
  STORAGE_A_STORAGEID: F,

      BALANCE_A_S_ADDRESS: F (bits),
      BALANCE_A_S_BALANCE: F,
      BALANCE_A_S_WEIGHTAMM: F,

      BALANCE_A_B_BALANCE: F

      ACCOUNT_A_ADDRESS: F (bits),
      ACCOUNT_A_OWNER: F,
      ACCOUNT_A_PUBKEY_X: F,
      ACCOUNT_A_PUBKEY_Y: F,
      ACCOUNT_A_NONCE: F,
      ACCOUNT_A_FEEBIPSAMM: F,

      STORAGE_B_ADDRESS: F (bits),
      STORAGE_B_DATA: F,
      STORAGE_B_STORAGEID: F,

      BALANCE_B_S_ADDRESS: F (bits),
      BALANCE_B_S_BALANCE: F,

      BALANCE_B_B_BALANCE: F,

      ACCOUNT_B_ADDRESS: F (bits),
      ACCOUNT_B_OWNER: F,
      ACCOUNT_B_PUBKEY_X: F,
      ACCOUNT_B_PUBKEY_Y: F,
      ACCOUNT_B_NONCE: F,

      BALANCE_P_A_BALANCE: F,
      BALANCE_P_B_BALANCE: F,

      BALANCE_O_A_BALANCE: F,
      BALANCE_O_B_BALANCE: F,

      HASH_A: F,
      PUBKEY_X_A: F,
      PUBKEY_Y_A: F,
      SIGNATURE_REQUIRED_A: F,

      HASH_B: F,
      PUBKEY_X_B: F,
      PUBKEY_Y_B: F,
      SIGNATURE_REQUIRED_B: F,

      NUM_CONDITIONAL_TXS: F,

      DA: F (x bits)

  )

## DualVariableGadget

This gadget is a simple wrapper around `libsnark::dual_variable_gadget`.

The gadget is used in two different ways:

- To ensure a value matches its bit representation using a specified number of bits
- As a range check: value < 2^n with n the number of bits

## DynamicBalanceGadget and DynamicVariableGadget

This gadget contains a stack of `VariableT` variables.

The gadget is used to make writing circuits easier. A `VariableT` can only have a single value at all times, so using this to represent a mutable value isn't possible.

A single instance of a DynamicVariableGadget can be created which internally contains a list of `VariableT` members. When the value needs to be updated a new `VariableT` is pushed on top of the stack. This way using the latest value is just looking at the `VariableT` at the top of the list.

## LeqGadget

This gadget is a wrapper around `libsnark::comparison_gadget`, exposing `<`, `<=`, `==`, `>=` and `>` for simplicity (and sometimes efficiensy if the same comparison result can be reused e.g. when both `<` and `<=` are needed).

One important limitation of `libsnark::comparison_gadget` is that it does not work for values close to the max field element value. This is an implementation detail as the gadget depends on there being an extra bit at MSB of the valules to be available. As the max field element is ~254 bits, only 253 bits can be used. And because the implementation needs an extra bit we can only compare values that take up at most 252 bits.

This is _not_ checked in the gadget itself, and it depends on the caller to specifiy a valid `n` which is the max number of bits of the value passed into the gadget.

## OwnerValid statement

A valid instance of an OwnerValid statement assures that given an input of:

- oldOwner: F
- newOwner: F

such that the following conditions hold:

- (oldOwner == newOwner) || (oldOwner == 0)

## CompressPublicKey statement

A valid instance of an CompressPublicKey statement assures that given an input of:

- publicKeyX: F
- publicKeyY: F

the prover knows an auxiliary input:

- compressedPublicKey_bits: {0..2^256}

The following conditions hold:

If publicKeyY != 0

- publicKeyY = compressedPublicKey_bits[0..254[
- compressedPublicKey_bits[254] = 0
- publicKeyX = (compressedPublicKey_bits[255] == 1 ? -1 : 1) \* sqrt((y\*y - 1) / ((JubJub.D \* y\*y) - JubJub.A)
  If publicKeyY == 0
- compressedPublicKey_bits[0..256[ = 0

Notes:

- sqrt always needs to return the positive root, which is defined by root < 0 - root. Otherwise the prover can supply either the negative root or the positive root as a valid result of sqrt when the constraint is defined as x == y \* y == -y \* -y.
- A special case is to allow publicKeyX == publicKeyY == 0, which isn't a valid point. This allows disabling the ability to sign with EdDSA with the account).

## SignatureVerifier statement

Given inputs:

- publicKeyX: F
- publicKeyY: F
- message: F
- required: {0..1}
- signature: Signature

The following conditions hold:

- If and only if required == 1: signature is valid for (publicKeyX, publicKeyY)

## StorageReader statement

A valid instance of a StorageReader statement assures that given an input of:

- storage: Storage
- storageID: {0..2^NUM_BITS_STORAGEID}
- verify: {0..1}

the prover knows an auxiliary input:

- data: F

such that the following conditions hold:

- if verify == 1 then storageID >= storage.storageID
- data = (storageID == storage.storageID) ? storage.data : 0

### Description

Reads data at storageID in the storage tree of the account, but allows the data to be overwritten by increasing the storageID and reading the tree at storageID % 2^TREE_DEPTH_STORAGE.

## Nonce statement

A valid instance of a Nonce statement assures that given an input of:

- storage: Storage
- storageID: {0..2^NUM_BITS_STORAGEID}
- verify: {0..1}

the prover knows an auxiliary input:

- data: F

such that the following conditions hold:

- data = StorageReader(storage, storageID, verify)
- if verify == 1 then data == 0

### Description

Builds a simple parallel nonce system on top of the storage tree. Transactions can use any storage slot that contains 0 as data (after overwriting logic). This slot will be overwritten with a 1, making it impossible to re-use the transaction multiple times.

## RequireAccuracy statement

A valid instance of an RequireAccuracy statement assures that the prover knows the auxiliary inputs of:

- value: F
- original: F

with circuit parameters:

- accuracy: Accuracy
- maxNumBits: unsigned int

such that the following conditions hold:

- value < 2^maxNumBits (range check)
- value <= original (RequireLeqGadget)
- original \* accuracy.N <= value \* accuracy.D (RequireLeqGadget)

Notes:

- value is first range checked to ensure value can be used in LeqGadget

### Description

This is a simple gadget that ensures the valid specified are approximately the same. The main reason this gadget is used is because the amounts that are compressed by using decimal floats can have small rounding errors.

## Float statement

Given inputs:

- floatValue_bits: {0..2^(numBitsExponent+numBitsMantissa)}
- decodedValue: F

The following conditions hold:

- decodedValue = floatValue[0..numBitsMantissa[ \* (10^floatValue[numBitsMantissa, numBitsExponent+numBitsMantissa[)

Notes:

- We can only decode floats in the circuits, we never encode floats (which is a heavier operation normally)
- Floats are used to reduce the amount of data we have to put on-chain for amounts.

## Deposit statement

A valid instance of an Deposit statement assures that given an input of:

- owner: {0..2^NUM_BITS_ADDRESS}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenID: {0..2^NUM_BITS_TOKENID}
- amount: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- state: State
- output: TxOutput

such that the following conditions hold:

- owner_bits = owner_packed
- accountID_bits = accountID_packed
- tokenID_bits = tokenID_packed
- amount_bits = amount_packed

- OwnerValid(account_old.owner, owner)

- output.ACCOUNT_A_ADDRESS = accountID
- output.ACCOUNT_A_OWNER = owner
- output.BALANCE_A_S_ADDRESS = tokenID
- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance + amount
- output.SIGNATURE_REQUIRED_A = 0
- output.SIGNATURE_REQUIRED_B = 0
- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions + 1
- output.DA = {
  TransactionType.Deposit,
  owner,
  accountID,
  tokenID,
  amount
  }

Notes:

- The Merkle tree is allowed to have multiple accounts with the same owner.
- owner cannot be 0, but this is enforced in the smart contracts.

### Description

This gadgets allows depositing funds to a new or existing account at accountID. The owner of an account can never change, unless account_old.owner == 0, which means a new account is created for owner.

The tokenID balance in balance_old for accountID account account_old is increased by amount.

As deposits are stored on-chain, we have to process this transaction in the smart contract, and so numConditionalTransactions is incremented.

## AccountUpdate statement

A valid instance of an AccountUpdate statement assures that given an input of:

- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- owner: {0..2^NUM_BITS_ADDRESS}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- validUntil: {0..2^NUM_BITS_TIMESTAMP}
- publicKeyX: F
- publicKeyY: F
- feeTokenID: {0..2^NUM_BITS_TOKENID}
- fee: {0..2^NUM_BITS_AMOUNT}
- maxFee: {0..2^NUM_BITS_AMOUNT}
- type: {0..2^8}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

- state: State
- output: TxOutput
- hash: F
- compressedPublicKey: {0..2^254}
- fFee: {0..2^16}
- uFee: F
- da_bits: {0..2^NUM_BITS_DA}

such that the following conditions hold:

- owner_bits = owner_packed
- accountID_bits = accountID_packed
- validUntil_bits = validUntil_packed
- feeTokenID_bits = feeTokenID_packed
- fee_bits = fee_packed
- maxFee_bits = maxFee_packed
- type_bits = type_packed
- account_old.nonce_bits = account_old.nonce_packed

- hash = PoseidonHash_t9f6p53(
  exchange,
  accountID,
  feeTokenID,
  maxFee,
  publicKeyX,
  publicKeyY,
  validUntil,
  nonce
  );
- OwnerValid(account_old.owner, owner)
- timestamp < validUntil
- fee <= maxFee
- CompressPublicKey(publicKeyX, publicKeyY, compressedPublicKey)
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)

- output.ACCOUNT_A_ADDRESS = accountID
- output.ACCOUNT_A_OWNER = owner
- output.ACCOUNT_A_PUBKEY_X = publicKeyX
- output.ACCOUNT_A_PUBKEY_Y = publicKeyY
- output.ACCOUNT_A_NONCE = state.accountA.account.nonce + 1
- output.BALANCE_A_S_ADDRESS = feeTokenID
- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance - uFee
- output.BALANCE_O_B_BALANCE = state.operator.balanceB.balance + uFee
- output.HASH_A = hash
- output.SIGNATURE_REQUIRED_A = (type == 0) ? 0 : 1
- output.SIGNATURE_REQUIRED_B = 0
- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions + ((type == 0) ? 0 : 1)
- output.DA = {
  TransactionType.AccountUpdate,
  owner,
  accountID,
  feeTokenID,
  fFee,
  compressedPublicKey,
  nonce
  }

Notes:

- The Merkle tree is allowed to have multiple accounts with the same owner.
- owner cannot be 0, but this is enforced in the smart contracts.

### Description

This gadgets allows setting the account EdDSA public key in a new or existing account at accountID. The owner of an account can never change, unless account_old.owner == 0, which means a new account is created for owner.

A fee is paid to the operator. The tokenID balance in balance_old for accountID account account_old is decreased by uFee. The tokenID balance in balanceOperator_old for operatorAccountID account accountOperator_old is increased by uFee.

The public key can either be set

- with the help of an on-chain signature. In this case no valid EdDSA signature needs to be provided and numConditionalTransactions is incremented.
- with the help of an EdDSA signature. In this case a valid signature for (account_old.publicKeyX, account_old.publicKeyY) needs to be provided signing hash. numConditionalTransactions is not incremented.

## AmmUpdate statement

A valid instance of an AmmUpdate statement assures that given an input of:

- owner: {0..2^NUM_BITS_ADDRESS}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenID: {0..2^NUM_BITS_TOKENID}
- feeBips: {0..2^NUM_BITS_AMM_BIPS}
- tokenWeight: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- state: State
- output: TxOutput

such that the following conditions hold:

- owner_bits = owner_packed
- accountID_bits = accountID_packed
- tokenID_bits = tokenID_packed
- feeBips_bits = feeBips_packed
- tokenWeight_bits = tokenWeight_packed
- state.accountA.account.nonce_bits = state.accountA.account.nonce_packed
- state.accountA.balanceS.balance_bits = state.accountA.balanceS.balance_packed

- output.ACCOUNT_A_ADDRESS = accountID
- output.ACCOUNT_A_NONCE = state.accountA.account.nonce + 1
- output.BALANCE_A_FEEBIPSAMM = feeBips
- output.BALANCE_A_S_ADDRESS = tokenID
- output.BALANCE_A_S_WEIGHTAMM = tokenWeight
- output.SIGNATURE_REQUIRED_A = 0
- output.SIGNATURE_REQUIRED_B = 0
- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions + 1
- output.DA = {
  TransactionType.AmmUpdate,
  owner,
  accountID,
  tokenID,
  feeBips,
  tokenWeight,
  account_old.nonce,
  balance_old.balance,
  padding_zeros
  }

### Description

This gadgets allows setting the feeBipsAMM and tokenWeightAMM parameters on an existing account at accountID.

The tokenID weightAMM in balance_old for accountID account account_old is set to the input weightAMM.
The feeBipsAMM in account_old for accountID account account_old is set to the input feeBipsAMM.

All AMM updates need to be authorized in the smart contract, and so numConditionalTransactions is incremented.

The nonce and balance are added in da to make those values available on-chain (which we use in our AMM pool smart contracts).

## Noop statement

A valid instance of an Noop statement assures that given an input of:

-

the prover knows an auxiliary input:

-

such that the following conditions hold:

- No changes are done to the Merkle tree or any other intermediate block values (like numConditionalTransactions)

### Description

Can be used to fill up blocks that are not fully filled with actual transactions.

## Withdraw statement

A valid instance of an Withdraw statement assures that given an input of:

- txType: {0..2^NUM_BITS_TYPE}
- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenID: {0..2^NUM_BITS_TOKENID}
- amount: {0..2^NUM_BITS_AMOUNT}
- feeTokenID: {0..2^NUM_BITS_TOKENID}
- maxFee: {0..2^NUM_BITS_AMOUNT}
- fee: {0..2^NUM_BITS_AMOUNT}
- validUntil: {0..2^NUM_BITS_TIMESTAMP}
- onchainDataHash: {0..2^NUM_BITS_HASH}
- storageID: {0..2^NUM_BITS_STORAGEID}
- type: {0..2^NUM_BITS_TYPE}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

- state: State
- output: TxOutput
- owner: {0..2^NUM_BITS_ADDRESS}
- hash: F
- fFee: {0..2^16}
- uFee: F
- da_bits: {0..2^NUM_BITS_DA}

such that the following conditions hold:

- owner_bits = owner_packed
- accountID_bits = accountID_packed
- validUntil_bits = validUntil_packed
- feeTokenID_bits = feeTokenID_packed
- fee_bits = fee_packed
- maxFee_bits = maxFee_packed
- type_bits = type_packed
- state.accountA.account.nonce_bits = state.accountA.account.nonce_packed

- hash = PoseidonHash_t10f6p53(
  exchange,
  accountID,
  tokenID,
  amount,
  feeTokenID,
  maxFee,
  onchainDataHash,
  validUntil,
  storageID
  );
- owner = (accountID == 0) ? 0 : state.accountA.account.owner
- timestamp < validUntil (RequireLtGadget)
- fee <= maxFee (RequireLeqGadget)
- if type == 2 then amount = balance_old.balance
- if type == 3 then amount = 0

- SignatureVerifier(account_old.publicKeyX, account_old.publicKeyY, hash, (type == 0) ? 1 : 0)
- Nonce(storage_old, storageID, (txType == TransactionType.Withdraw && (type == 0 || type == 1)))
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)

- output.ACCOUNT_A_ADDRESS = (accountID == 0) ? 1 : accountID
- output.BALANCE_A_S_ADDRESS = tokenID
- output.BALANCE_B_S_ADDRESS = feeTokenID
- output.BALANCE_A_S_WEIGHTAMM = (accountID != 0 && type == 2) ? 0 : state.accountA.balanceS.tokenWeightAMM
- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance - ((accountID == 0) ? 0 : amount)
- output.BALANCE_A_B_BALANCE = state.accountA.balanceB.balance - uFee
- output.BALANCE_O_A_BALANCE = state.operator.balanceA.balance + uFee
- output.BALANCE_P_B_BALANCE = state.pool.balanceB.balance - ((accountID == 0) ? amount : 0)
- output.HASH_A = hash
- output.SIGNATURE_REQUIRED_A = (type == 0) ? 1 : 0
- output.SIGNATURE_REQUIRED_B = 0
- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions + 1
- output.STORAGE_A_ADDRESS = storageID[0..NUM_BITS_STORAGE_ADDRESS]
- output.STORAGE_A_DATA = (accountId != 0 && type == 2) ? 1 : state.accountA.storage.data
- output.STORAGE_A_STORAGEID = (accountId != 0 && type == 2) ? storageID : state.accountA.storage.storageID
- output.DA = = {
  TransactionType.Withdraw,
  owner,
  accountID,
  tokenID,
  amount,
  feeTokenID,
  fFee,
  storageID,
  onchainDataHash,
  padding_zeros
  }

Notes:

- The Merkle tree is allowed to have multiple accounts with the same owner.
- owner cannot be 0, but this is enforced in the smart contracts.

### Description

This gadgets allows withdrawing from an account at accountID.

Withdrawing from account == 0 is special because this is where the protocol fees are stored and these balances are not immediately committed to the Merkle tree state. This is why some special logic is needed to make sure we don't do any unexpected state changes on that account.

amount is subtracted from the users balance_old at tokenID. Depending on the type, amount may need to have a specific value:

- type == 0 || type == 1: any amount is allowed as long as amount >= balance_old.balance
- type == 2: amount == balance_old.balance
- type == 3: amount == 0

These different types are used on-chain to correctly handle withdrawals.

A fee is paid to the operator. The feeTokenID balance in balanceF_old for accountID account account_old is decreased by uFee. The feeTokenID balance in balanceOperator_old for operatorAccountID account accountOperator_old is increased by uFee.

Only when type == 0 is a valid EdDSA signature required.

In all cases the withdrawal transaction needs to be processed on-chain, so numConditionalTransactions is always incremente

## SelectTransaction statement

A valid instance of an SelectTransaction statement assures that given an input of:

- selector_bits: {0..2^7}
- outputs[7]: TxOutput

the prover knows an auxiliary input:

- output: TxOutput

such that the following conditions hold:

- for each var in TxOutput.uOutputs: output.uOutputs.var = Select(selector_bits, outputs[0..7].uOutputs.var)
- for each var in TxOutput.aOutputs: output.aOutputs.var = ArraySelect(selector_bits, outputs[0..7].aOutputs.var)
- for each var in TxOutput.da: output.da = ArraySelect(selector_bits, outputs[0..7].da), wit outputs[i].da padded to (TX_DATA_AVAILABILITY_SIZE - 1) \* 8 bits with zeros

### Description

This gadget selects the correct output for the transaction that's being executed. All transactions types are always executed in the circuit, so we select the transaction of the correct type here.

## Transaction statement

A valid instance of an Transaction statement assures that given an input of:

- txType: {0..2^NUM_BITS_TX_TYPE}
- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- protocolTakerFeeBips: F
- protocolMakerFeeBips: F
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

- state: State
- root_old: F
- root_new: F
- numConditionalTransactions_old: F
- numConditionalTransactions_new: F
- outputs: TxOutput[7]
- output: TxOutput
- da_bits: {0..2^NUM_BITS_DA}

such that the following conditions hold:

- txType_bits = txType_packed
- selector = Selector(txType)
- outputs[0] = Noop(state)
- outputs[1] = SpotTrade(state)
- outputs[2] = Deposit(state)
- outputs[3] = Withdraw(state)
- outputs[4] = AccountUpdate(state)
- outputs[5] = Transfer(state)
- outputs[6] = AmmUpdate(state)
- output = SelectTransaction(selector, outputs)

- output.ACCOUNT_A_ADDRESS_bits = output.ACCOUNT_A_ADDRESS_packed
- output.ACCOUNT_B_ADDRESS_bits = output.ACCOUNT_B_ADDRESS_packed
- output.ACCOUNT_A_ADDRESS != 0
- output.ACCOUNT_B_ADDRESS != 0

- SignatureVerifier(output.PUBKEY_X_A, output.PUBKEY_Y_A, output.HASH_A, output.SIGNATURE_REQUIRED_A)
- SignatureVerifier(output.PUBKEY_X_B, output.PUBKEY_Y_B, output.HASH_B, output.SIGNATURE_REQUIRED_B)

- There is a valid path at output.STORAGE_A_ADDRESS from state.accountA.storage to state.accountA.balanceS.storageRoot
- There is a valid path at output.STORAGE_A_ADDRESS from (output.STORAGE_A_DATA, output.STORAGE_A_STORAGEID) to root_updateStorage_A
- There is a valid path at output.BALANCE_A_S_ADDRESS from state.accountA.balanceS to state.accountA.account.balancesRoot
- There is a valid path at output.BALANCE_A_S_ADDRESS from (output.BALANCE_A_S_BALANCE, output.BALANCE_A_S_WEIGHTAMM, root_updateStorage_A) to root_updateBalanceS_A
- There is a valid path at output.BALANCE_B_S_ADDRESS from state.accountA.balanceB to root_updateBalanceS_A
- There is a valid path at output.BALANCE_B_S_ADDRESS from (output.BALANCE_A_B_BALANCE, state.accountA.balanceB.weightAMM, state.accountA.balanceB.storageRoot) to root_updateBalanceB_A
- There is a valid path at output.ACCOUNT_A_ADDRESS from state.accountA.account to root_old
- There is a valid path at output.ACCOUNT_A_ADDRESS from (output.ACCOUNT_A_OWNER, output.ACCOUNT_A_PUBKEY_X, output.ACCOUNT_A_PUBKEY_Y, output.ACCOUNT_A_NONCE, output.ACCOUNT_A_FEEBIPSAMM, root_updateBalanceB_A) to root_updateAccount_A

- There is a valid path at output.STORAGE_B_ADDRESS from state.accountB.storage to state.accountB.balanceS.storageRoot
- There is a valid path at output.STORAGE_B_ADDRESS from (output.STORAGE_B_DATA, output.STORAGE_B_STORAGEID) to root_updateStorage_B
- There is a valid path at output.BALANCE_B_S_ADDRESS from state.accountB.balanceS to state.accountB.account.balancesRoot
- There is a valid path at output.BALANCE_B_S_ADDRESS from (output.BALANCE_B_S_BALANCE, state.accountB.balanceS.weightAMM, root_updateStorage_B) to root_updateBalanceS_B
- There is a valid path at output.BALANCE_A_S_ADDRESS from state.accountB.balanceB to root_updateBalanceS_B
- There is a valid path at output.BALANCE_A_S_ADDRESS from (output.BALANCE_B_B_BALANCE, state.accountB.balanceB.weightAMM, state.accountB.balanceB.storageRoot) to root_updateBalanceB_B
- There is a valid path at output.ACCOUNT_B_ADDRESS from state.accountB.account to root_updateAccount_A
- There is a valid path at output.ACCOUNT_B_ADDRESS from (output.ACCOUNT_A_OWNER, output.ACCOUNT_A_PUBKEY_X, output.ACCOUNT_A_PUBKEY_Y, output.ACCOUNT_A_NONCE, state.accountB.account.feeBips, root_updateBalanceB_B) to root_updateAccount_B

- There is a valid path at output.BALANCE_A_S_ADDRESS from state.operator.balanceB to state.operator.account.balancesRoot
- There is a valid path at output.BALANCE_A_S_ADDRESS from (output.BALANCE_O_B_BALANCE, state.operator.balanceB.weightAMM, state.operator.balanceB.storageRoot) to root_updateBalanceB_O
- There is a valid path at output.BALANCE_B_S_ADDRESS from state.operator.balanceS to root_updateBalanceS_B
- There is a valid path at output.BALANCE_B_S_ADDRESS from (output.BALANCE_O_A_BALANCE, state.operator.balanceS.weightAMM, state.operator.balanceS.storageRoot) to root_updateBalanceA_O
- There is a valid path at operatorAccountID from state.operator.account to root_updateAccount_B
- There is a valid path at operatorAccountID from (state.operator.account.owner, state.operator.account.publicKeyX, state.operator.account.publicKeyY, state.operator.account.nonce, state.operator.account.feeBips, root_updateBalanceA_O) to root_new

- There is a valid path at output.BALANCE_A_S_ADDRESS from state.pool.balanceB to protocolBalancesRoot_old
- There is a valid path at output.BALANCE_A_S_ADDRESS from (output.BALANCE_P_B_BALANCE, 0, EMPTY_STORAGE_ROOT) to root_updateBalanceB_P
- There is a valid path at output.BALANCE_B_S_ADDRESS from state.pool.balanceS to root_updateBalanceB_P
- There is a valid path at output.BALANCE_B_S_ADDRESS from (output.BALANCE_P_A_BALANCE, 0, EMPTY_STORAGE_ROOT) to protocolBalancesRoot_new

### Description

This gadget executes the required logic for the transaction (by executing the logic for each transactions type and then selecting the right output) and using the output of the transaction to do all shared and heavy operations: signature checking and Merkle tree updates. By sharing these operations between all transaction types the resulting circuit is much more efficient than if we would simply do these operations for all transactions types all times (as the number of constraints produced would simply stack on top of each other).

To do this, all data that could be updated in any of the transactions is stored in a shared output data interface. We then always update all output data, even if it remains the same.
