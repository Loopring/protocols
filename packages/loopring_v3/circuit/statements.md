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

## MerklePathSelector statement

A valid instance of an MerklePathSelector statement assures that given an input of:

- input: F
- sideNodes: F[3]
- bit0: {0..1}
- bit1: {0..1}

the prover knows an auxiliary input:

- children: F[4]

such that the following conditions hold:

- if bit1 == 0 && bit0 == 0: children = [input, sideNodes[0], sideNodes[1], sideNodes[2]]
- if bit1 == 0 && bit0 == 1: children = [sideNodes[0], input, sideNodes[1], sideNodes[2]]
- if bit1 == 1 && bit0 == 0: children = [sideNodes[0], sideNodes[1], input, sideNodes[2]]
- if bit1 == 1 && bit0 == 1: children = [sideNodes[0], sideNodes[1], sideNodes[2], input]

## MerklePath statement

A valid instance of an MerklePath statement assures that given an input of:

- depth: unsigned int
- address: {0..2^NUM_BITS_ACCOUNT}
- leaf: F
- proof: F[3 * depth]

the prover knows an auxiliary input:

- result: F
- hashes: F[depth]
- children: F[depth][4]

such that the following conditions hold:

- for i in [0..depth[:
  children[i] = MerklePathSelector(
  (i == 0) ? leaf : hashes[i-1],
  {proof[3*i + 0], proof[3*i + 1], proof[3*i + 2]},
  address[2*i + 0],
  address[2*i + 1]
  )
  hashes[i] = PoseidonHash_t5f6p52(children[i])
- result = hashes[depth-1]

## MerklePathCheck statement

A valid instance of an MerklePathCheck statement assures that given an input of:

- depth: unsigned int
- address: {0..2^NUM_BITS_ACCOUNT}
- leaf: F
- root: F
- proof: F[3 * depth]

the prover knows an auxiliary input:

- expectedRoot: F

such that the following conditions hold:

- expectedRoot = MerklePath(depth, address, leaf, proof)
- root = expectedRoot

## UpdateAccount statement

A valid instance of an UpdateAccount statement assures that given an input of:

- root_before: F
- address: {0..2^NUM_BITS_ACCOUNT}
- before: Account
- after: Account

the prover knows an auxiliary input:

- root_after: F
- proof: F[3 * NUM_BITS_ACCOUNT]

such that the following conditions hold:

- hash_before = PoseidonHash_t7f6p52(
  before.owner,
  before.publicKeyX,
  before.publicKeyY,
  before.nonce,
  before.feeBipsAMM,
  before.balancesRoot
  )
- hash_after = PoseidonHash_t7f6p52(
  after.owner,
  after.publicKeyX,
  after.publicKeyY,
  after.nonce,
  after.feeBipsAMM,
  after.balancesRoot
  )
- MerklePathCheck(TREE_DEPTH_ACCOUNTS, address, hash_before, root_before, proof)
- root_after = MerklePath(TREE_DEPTH_ACCOUNTS, address, hash_after, proof)

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

- Nonce(state.accountA.storage, storageID, (txType == TransactionType.Withdraw && (type == 0 || type == 1)))
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

In all cases the withdrawal transaction needs to be processed on-chain, so numConditionalTransactions is always incremented.

## Transfer statement

A valid instance of an Transfer statement assures that given an input of:

- txType: {0..2^NUM_BITS_TYPE}
- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- fromAccountID: {0..2^NUM_BITS_ACCOUNTID}
- toAccountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenID: {0..2^NUM_BITS_TOKENID}
- amount: {0..2^NUM_BITS_AMOUNT}
- feeTokenID: {0..2^NUM_BITS_TOKENID}
- maxFee: {0..2^NUM_BITS_AMOUNT}
- fee: {0..2^NUM_BITS_AMOUNT}
- validUntil: {0..2^NUM_BITS_TIMESTAMP}
- onchainDataHash: {0..2^NUM_BITS_HASH}
- storageID: {0..2^NUM_BITS_STORAGEID}
- type: {0..2^NUM_BITS_TYPE}
- to: {0..2^NUM_BITS_ADDRESS}
- dualAuthorX: F
- dualAuthorY: F
- payer_toAccountID: {0..2^NUM_BITS_ACCOUNTID}
- payer_to: {0..2^NUM_BITS_ADDRESS}
- payee_toAccountID: {0..2^NUM_BITS_ACCOUNTID}
- putAddressesInDA: {0..1}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

- state: State
- output: TxOutput
- from: {0..2^NUM_BITS_ADDRESS}
- hashPayer: F
- hashDual: F
- fFee: {0..2^16}
- uFee: F
- fAmount: {0..2^24}
- uAmount: F

such that the following conditions hold:

- fromAccountID_bits = fromAccountID_packed
- toAccountID_bits = toAccountID_packed
- tokenID_bits = tokenID_packed
- amount_bits = amount_packed
- feeTokenID_bits = feeTokenID_packed
- fee_bits = fee_packed
- validUntil_bits = validUntil_packed
- type_bits = type_packed
- from_bits = from_packed
- to_bits = to_packed
- storageID_bits = storageID_packed
- payer_toAccountID_bits = payer_toAccountID_packed
- payer_to_bits = payer_to_packed
- payee_toAccountID_bits = payee_toAccountID_packed
- maxFee_bits = maxFee_packed
- putAddressesInDA_bits = putAddressesInDA_packed

- hashPayer = PoseidonHash_t13f6p53(
  exchange,
  fromAccountID,
  payer_toAccountID,
  tokenID,
  amount,
  feeTokenID,
  maxFee,
  payer_to,
  dualAuthorX,
  dualAuthorY,
  validUntil,
  storageID
  )
- hashDual = PoseidonHash_t13f6p53(
  exchange,
  fromAccountID,
  payee_toAccountID,
  tokenID,
  amount,
  feeTokenID,
  maxFee,
  to,
  dualAuthorX,
  dualAuthorY,
  validUntil,
  storageID
  )
- timestamp < validUntil (RequireLtGadget)
- fee <= maxFee (RequireLeqGadget)
- if (payerTo != 0) then payerTo = to
- if (payerTo != 0) then payer_toAccountID = payee_toAccountID
- if (payee_toAccountID != 0) then payee_toAccountID = toAccountID
- if (txType == TransactionType.Transfer) then to != 0
- to = state.accountB.account.owner
- Nonce(state.accountA.storage, storageID, (txType == TransactionType.Transfer))
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)
- Float(fAmount, uAmount)
- RequireAccuracy(uAmount, amount)

- output.ACCOUNT_A_ADDRESS = fromAccountID
- output.ACCOUNT_B_ADDRESS = toAccountID
- output.ACCOUNT_B_OWNER = to
- output.BALANCE_A_S_ADDRESS = tokenID
- output.BALANCE_B_S_ADDRESS = feeTokenID
- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance - uAmount
- output.BALANCE_B_B_BALANCE = state.accountB.balanceB.balance + uAmount
- output.BALANCE_A_B_BALANCE = state.accountA.balanceB.balance - uFee
- output.BALANCE_O_A_BALANCE = state.operator.balanceA.balance + uFee
- output.HASH_A = hashPayer
- output.HASH_B = hashDual
- output.PUBKEY_X_B = (dualAuthorX == 0 && dualAuthorY == 0) ? state.accountA.account.publicKey.x : dualAuthorX
- output.PUBKEY_Y_B = (dualAuthorX == 0 && dualAuthorY == 0) ? state.accountA.account.publicKey.y : dualAuthorY
- output.SIGNATURE_REQUIRED_A = (type == 0) ? 1 : 0
- output.SIGNATURE_REQUIRED_B = (type == 0) ? 1 : 0
- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions + (type != 0) ? 1 : 0
- output.STORAGE_A_ADDRESS = storageID[0..NUM_BITS_STORAGE_ADDRESS]
- output.STORAGE_A_DATA = 1
- output.STORAGE_A_STORAGEID = storageID
- output.DA = (
  TransactionType.Transfer,
  fromAccountID,
  toAccountID,
  tokenID,
  fAmount,
  feeTokenID,
  fFee,
  storageID,
  (state.accountA.account.owner == 0 || type == 1 || putAddressesInDA == 1) ? to : 0,
  (type == 1 || putAddressesInDA == 1) ? from : 0,
  padding_zeros
  )

### Description

This gadgets allows transferring amount tokens from token tokenID from account fromAccountID to accoun toAccountID.

A fee is paid to the operator. The feeTokenID balance in the users's account is decreased by uFee. The feeTokenID balance in the operator's account is increased by uFee.

Only when type == 0 is a valid EdDSA signature required.

When type == 1 the transfer transaction needs to be processed on-chain, so numConditionalTransactions is incremented.

## Order statement

A valid instance of an Order statement assures that given an input of:

- txType: {0..2^NUM_BITS_TYPE}
- exchange: {0..2^NUM_BITS_ADDRESS}
- storageID: {0..2^NUM_BITS_STORAGEID}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenS: {0..2^NUM_BITS_TOKENID}
- tokenB: {0..2^NUM_BITS_TOKENID}
- amountS: {0..2^NUM_BITS_AMOUNT}
- amountB: {0..2^NUM_BITS_AMOUNT}
- validUntil: {0..2^NUM_BITS_TIMESTAMP}
- maxFeeBips: {0..2^NUM_BITS_FEE_BIPS}
- fillAmountBorS: {0..1}
- taker: F
- feeBips: {0..2^NUM_BITS_FEE_BIPS}
- amm: {0..1}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

-

such that the following conditions hold:

- storageID_bits = storageID_packed
- accountID_bits = accountID_packed
- tokenS_bits = tokenS_packed
- tokenB_bits = tokenB_packed
- amountS_bits = amountS_packed
- amountB_bits = amountB_packed
- maxFeeBips_bits = maxFeeBips_packed
- feeBips_bits = feeBips_packed
- validUntil_bits = validUntil_packed
- fillAmountBorS_bits = fillAmountBorS_packed

- hash = PoseidonHash_t12f6p53(
  exchange,
  storageID,
  accountID,
  tokenS,
  tokenB,
  amountS,
  amountB,
  validUntil,
  maxFeeBips,
  fillAmountBorS,
  taker
  )
- feeBips <= maxFeeBips (RequireLeqGadget)
- tokenS != tokenB
- amountS != 0
- amountB != 0

## RequireFillRate statement

A valid instance of an Order statement assures that given an input of:

- amountS: {0..2^NUM_BITS_AMOUNT}
- amountB: {0..2^NUM_BITS_AMOUNT}
- fillAmountS: {0..2^NUM_BITS_AMOUNT}
- fillAmountB: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

-

such that the following conditions hold:

- (fillAmountS _ amountB _ 1000) <= (fillAmountB _ amountS _ 1001) (RequireLeqGadget)
- (fillAmountS == 0 && fillAmountB == 0) || (fillAmountS != 0 && fillAmountB != 0)

### Description

The fill rate can be up to 0.1% higher than the max fill rate defined in the order to be more lenient for rounding errors.

The additional requirement for the fill amounts is to make sure rounding errors don't make it possible to only do a token transfer in a single direction (only receiving tokens or only sending tokens). This could allow an order to be used to drain an account.

## FeeCalculator statement

A valid instance of an Order statement assures that given an input of:

- amount: {0..2^NUM_BITS_AMOUNT}
- protocolFeeBips: {0..2^8}
- feeBips: {0..2^NUM_BITS_FEE_BIPS}

the prover knows an auxiliary input:

- protocolFee: F
- fee: F

such that the following conditions hold:

- protocolFee = amount \* protocolFeeBips // 100000
- fee = amount \* feeBips // 10000

## RequireValidOrder statement

A valid instance of an RequireValidOrder statement assures that given an input of:

- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- order: Order

the prover knows an auxiliary input:

-

such that the following conditions hold:

- timestamp < order.validUntil (RequireLtGadget)

## RequireFillLimit statement

A valid instance of an RequireFillLimit statement assures that given an input of:

- order: Order
- filled: {0..2^NUM_BITS_AMOUNT}
- fillS: {0..2^NUM_BITS_AMOUNT}
- fillB: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- fillAfter: {0..2^NUM_BITS_AMOUNT}

such that the following conditions hold:

- filledAfter = filled + ((order.fillAmountBorS == 0) ? fillB : fillS)
- (order.fillAmountBorS == 0) ? filledAfter <= order.amountB : filledAfter <= order.amountS

### Description

Allows orders to be limited against either the amount bought or the amount sold. This is useful because the price defined in the order is only the worst price the order can be filled.

## RequireOrderFills statement

A valid instance of an RequireOrderFills statement assures that given an input of:

- order: Order
- filled: {0..2^NUM_BITS_AMOUNT}
- fillS: {0..2^NUM_BITS_AMOUNT}
- fillB: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- filledAfter: {0..2^NUM_BITS_AMOUNT}

such that the following conditions hold:

- RequireFillRate(order.amountS, order.amountB, fillS, fillB)
- filledAfter = RequireFillLimit(order, filled, fillS, fillB)

## RequireValidTaker statement

A valid instance of an RequireValidTaker statement assures that given an input of:

- taker: F
- expectedTaker: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- (expectedTaker == 0) || (taker == expectedTaker)

### Description

Allows an order to be created that can only be matched agains a speicific counterparty.

## OrderMatching statement

A valid instance of an OrderMatching statement assures that given an input of:

- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- orderA: Order
- orderB: Order
- ownerA: {0..2^NUM_BITS_ADDRESS}
- ownerB: {0..2^NUM_BITS_ADDRESS}
- filledA: {0..2^NUM_BITS_AMOUNT}
- filledB: {0..2^NUM_BITS_AMOUNT}
- fillS_A: {0..2^NUM_BITS_AMOUNT}
- fillS_B: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- filledAfterA: {0..2^NUM_BITS_AMOUNT}
- filledAfterB: {0..2^NUM_BITS_AMOUNT}

such that the following conditions hold:

- filledAfterA = RequireOrderFills(orderA, filledA, fillS_A, fillS_B)
- filledAfterB = RequireOrderFills(orderB, filledB, fillS_B, fillS_A)
- orderA.tokenS == orderB.tokenB
- orderA.tokenB == orderB.tokenS
- ValidateTaker(ownerB, orderA.taker)
- ValidateTaker(ownerA, orderB.taker)
- RequireValidOrder(timestamp, orderA)
- RequireValidOrder(timestamp, orderB)

## SpotTrade statement

A valid instance of an SpotTrade statement assures that given an input of:

- txType: {0..2^NUM_BITS_TYPE}
- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- orderA: Order
- orderB: Order
- fillS_A: {0..2^24}
- fillS_B: {0..2^24}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}

the prover knows an auxiliary input:

- state: State
- output: TxOutput
- storageDataA: F
- storageDataB: F
- uFillS_A
- uFillS_B
- filledAfterA
- filledAfterB

such that the following conditions hold:

- Order(orderA)
- Order(orderB)
- Float(fillS_A, uFillS_A)
- Float(fillS_B, uFillS_B)
- storageDataA = StorageReader(state.accountA.storage, orderA.storageID, (txType == TransactionType.SpotTrade))
- storageDataB = StorageReader(state.accountB.storage, orderB.storageID, (txType == TransactionType.SpotTrade))
- OrderMatching(timestamp, orderA, orderB, state.accountA.account.owner, state.accountB.account.owner, storageDataA, storageDataB, uFillS_A, uFillS_B)
- (feeA, protocolFeeA) = FeeCalculator(uFillS_B, state.protocolTakerFeeBips, orderA.feeBips)
- (feeB, protocolFeeB) = FeeCalculator(uFillS_A, state.protocolMakerFeeBips, orderB.feeBips)

- output.BALANCE_A_S_ADDRESS = orderA.tokenS
- output.BALANCE_B_S_ADDRESS = orderB.tokenS

- output.ACCOUNT_A_ADDRESS = orderA.accountID
- output.ACCOUNT_B_ADDRESS = orderB.accountID

- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance - uFillS_A
- output.BALANCE_A_B_BALANCE = state.accountB.balanceB.balance + uFillS_B - feeA
- output.BALANCE_B_S_BALANCE = state.accountA.balanceB.balance - uFillS_B
- output.BALANCE_B_B_BALANCE = state.accountA.balanceB.balance + uFillS_A - feeB

- output.BALANCE_P_A_BALANCE = state.pool.balanceA.balance + protocolFeeA
- output.BALANCE_P_B_BALANCE = state.pool.balanceB.balance + protocolFeeB

- output.BALANCE_O_A_BALANCE = state.operator.balanceA.balance + feeA - protocolFeeA
- output.BALANCE_O_B_BALANCE = state.operator.balanceB.balance + feeB - protocolFeeB

- output.STORAGE_A_ADDRESS = orderA.storageID[0..NUM_BITS_STORAGE_ADDRESS]
- output.STORAGE_A_DATA = filledAfterA
- output.STORAGE_A_STORAGEID = orderA.storageID

- output.STORAGE_B_ADDRESS = orderB.storageID[0..NUM_BITS_STORAGE_ADDRESS]
- output.STORAGE_B_DATA = filledAfterB
- output.STORAGE_B_STORAGEID = orderB.storageID

- output.HASH_A = orderA.hash
- output.HASH_B = orderB.hash
- output.SIGNATURE_REQUIRED_A = (orderA.amm == 0) ? 1 : 0
- output.SIGNATURE_REQUIRED_B = (orderB.amm == 0) ? 1 : 0

- output.DA = (
  TransactionType.SpotTrade,
  orderA.storageID,
  orderB.storageID,
  orderA.accountID,
  orderB.accountID,
  orderA.tokenS,
  orderB.tokenS,
  fillS_A,
  fillS_B,
  orderA.fillAmountBorS, 0, orderA.feeBips,
  orderB.fillAmountBorS, 0, orderB.feeBips,
  padding_zeros
  )

### Description

This gadgets allows transferring amount tokens from token tokenID from account fromAccountID to accoun toAccountID.

A fee is paid to the operator. The feeTokenID balance in the users's account is decreased by uFee. The feeTokenID balance in the operator's account is increased by uFee.

Only when type == 0 is a valid EdDSA signature required.

When type == 1 the transfer transaction needs to be processed on-chain, so numConditionalTransactions is incremented.

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
- txInputs: TxInputs
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

such that the following conditions hold:

- txType_bits = txType_packed
- selector = Selector(txType)
- outputs[0] = Noop(state, txInputs)
- outputs[1] = SpotTrade(state, txInputs)
- outputs[2] = Deposit(state, txInputs)
- outputs[3] = Withdraw(state, txInputs)
- outputs[4] = AccountUpdate(state, txInputs)
- outputs[5] = Transfer(state, txInputs)
- outputs[6] = AmmUpdate(state, txInputs)
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

## PublicData statement

A valid instance of an PublicData statement assures that given an input of:

- data: bits[N]

the prover knows an auxiliary input:

- publicInput: F

such that the following conditions hold:

- publicInput = sha256(data) >> 3

### Description

3 LBS are stripped from the 256-bit hash so that the packed value always fits inside a field element.

## Universal statement

A valid instance of an Universal statement assures that given an input of:

- exchange: {0..2^NUM_BITS_ADDRESS}
- merkleRootBefore: {0..2^256}
- merkleRootAfter: {0..2^256}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- protocolTakerFeeBips: {0..2^NUM_BITS_PROTOCOL_FEE_BIPS}
- protocolMakerFeeBips: {0..2^NUM_BITS_PROTOCOL_FEE_BIPS}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}
- transactions: Transaction[N]

the prover knows an auxiliary input:

- accountP: Account
- accountO: Account
- numConditionalTransactions: {0..2^32}

such that the following conditions hold:

- exchange_bits = exchange_packed
- merkleRootBefore_bits = merkleRootBefore_packed
- merkleRootAfter_bits = merkleRootAfter_packed
- timestamp_bits = timestamp_packed
- protocolTakerFeeBips_bits = protocolTakerFeeBips_packed
- protocolMakerFeeBips_bits = protocolMakerFeeBips_packed
- operatorAccountID_bits = operatorAccountID_packed
- numConditionalTransactions_bits = numConditionalTransactions_packed

- for i in 0..N: Transaction(
  exchange,
  (i == 0) ? merkleRootBefore : Transaction[i-1].newAccountsRoot,
  timestamp,
  protocolTakerFeeBips,
  protocolMakerFeeBips,
  operatorAccountID,
  (i == 0) ? accountBefore_P.balancesRoot : Transaction[i-1].newPoolBalancesRoot,
  (i == 0) ? 0 : Transaction[i-1].output.NUM_CONDITIONAL_TXS,
  transactions[i]
  )

- numConditionalTransactions = Transaction[N-1].NUM_CONDITIONAL_TXS

- publicData = (
  exchange,
  merkleRootBefore,
  merkleRootAfter,
  timestamp,
  protocolTakerFeeBips,
  protocolMakerFeeBips,
  numConditionalTransactions,
  operatorAccountID,
  for i in 0..N: Transaction[i].output.DA, with the resulting bit array split in two parts: the initial 29 bytes grouped together first, then the remaining 39 grouped together.
  )
- publicInput = PublicData(publicData)

- hash = PoseidonHash_t3f6p51(
  publicInput,
  accountO.nonce
  )
- SignatureVerifier(accountO.publicKeyX, accountO.publicKeyY, hash, 1)

- root_P = UpdateAccount(
  Transaction[N-1].newAccountsRoot, 0,
  (accountP.owner, accountP.publicKey.x, accountP.publicKey.y, accountP.nonce, accountP.feeBipsAMM, accountP.balancesRoot},
  (accountP.owner, accountP.publicKey.x, accountP.publicKey.y, accountP.nonce, accountP.feeBipsAMM, Transaction[N-1].getNewProtocolBalancesRoot())
  )
- root_O = UpdateAccount(
  root_P, operatorAccountID,
  (accountO.owner, accountO.publicKey.x, accountO.publicKey.y, accountO.nonce, accountO.feeBipsAMM, accountO.balancesRoot},
  (accountO.owner, accountO.publicKey.x, accountO.publicKey.y, accountO.nonce + 1, accountO.feeBipsAMM, accountO.balancesRoot)
  )
- merkleRootAfter = root_O

### Description

Batches multiple transactions together in a block. All public input is hashed to the single field element publicInput, this makes verifying the proof more efficient.

The operator is required to sign the block. This is needed because the operator pays the protocol fees.
