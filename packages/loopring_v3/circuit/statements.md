## Constants

- NUM_BITS_ADDRESS := 160
- NUM_BITS_ACCOUNTID := 32
- NUM_BITS_TOKENID := 16
- NUM_BITS_AMOUNT := 96
- NUM_BITS_TIMESTAMP := 32
- NUM_BITS_NONCE := 32
- NUM_BITS_DA := 68\*8

- TransactionType.Noop := 0 (8 bits)
- TransactionType.Deposit := 1 (8 bits)
- TransactionType.Withdrawal := 2 (8 bits)
- TransactionType.Transfer := 3 (8 bits)
- TransactionType.SpotTrade := 4 (8 bits)
- TransactionType.AccountUpdate := 5 (8 bits)
- TransactionType.AmmUpdate := 6 (8 bits)

Data types:

- F: Snark field element
- StorageState := (data: F, storageID: F)
- Balance := (balance: F, weightAMM: F, storageRoot: F)
- Account := (owner: F, publicKeyX: F, publicKeyY: F, nonce: F, feeBipsAMM: F, balancesRoot: F)

- Accuracy := (N: unsigned int, D: unsigned int)

## OwnerValid statement

Given inputs:

- oldOwner: F
- newOwner: F

The following conditions hold:

- (oldOwner == newOwner) || (oldOwner == 0)

## CompressPublicKey statement

Given inputs:

- publicKeyX: F
- publicKeyY: F
- compressedPublicKey: F

The following conditions hold:

- ...

## SignatureVerifier statement

Given inputs:

- publicKeyX: F
- publicKeyY: F
- message: F
- required: {0..1}
- signature: Signature

The following conditions hold:

- If and only if required == 1: signature is valid for (publicKeyX, publicKeyY)

## RequireAccuracy statement

Given inputs:

- value: F
- original: F
- accuracy: Accuracy
- maxNumBits: unsigned int

The following conditions hold:

- value < 2^maxNumBits
- value <= original
- original _ accuracy.N <= value _ accuracy.D

## Float statement

Given inputs:

- floatValue: {0..2^(numBitsExponent+numBitsMantissa)}
- decodedValue: F

The following conditions hold:

- decodedValue = floatValue[0..numBitsMantissa[ \* (10^floatValue[numBitsMantissa, numBitsExponent+numBitsMantissa[)

## Deposit statement

Given private inputs:

- owner: {0..2^NUM_BITS_ADDRESS}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- tokenID: {0..2^NUM_BITS_TOKENID}
- amount: {0..2^NUM_BITS_AMOUNT}
- root_old: F
- root_new: F
- account_old: Account
- balance_old: Balance
- account_new: Account
- balance_new: Balance
- numConditionalTransactions_old: F
- numConditionalTransactions_new: F
- da: {0..2^NUM_BITS_DA}

The following conditions hold:

- accountID != 0
- OwnerValid(account_old.owner, owner)
- numConditionalTransactions_new = numConditionalTransactions_old + 1
- State update:
  - balance_new.balance = balance_old.balance + amount.
  - Except balance, all fields balance_old -> balance_new remain the same.
  - Except balancesRoot, all fields account_old -> account_new remain the same.
- Merkle Path Validity:
  - There is a valid path at tokenID from balance_old to account_old.balancesRoot. There is valid path at accountID from account_old to root_old.
  - There is a valid path at tokenID from balance_new to account_new.balancesRoot. There is valid path at accountID from account_new to root_new.
- da = {
  TransactionType.Deposit,
  owner,
  accountID,
  tokenID,
  amount,
  padding_zeros
  }

## AccountUpdate statement

Given private inputs:

- exchange: {0..2^NUM_BITS_ADDRESS}
- timestamp: {0..2^NUM_BITS_TIMESTAMP}
- owner: {0..2^NUM_BITS_ADDRESS}
- accountID: {0..2^NUM_BITS_ACCOUNTID}
- validUntil: {0..2^NUM_BITS_TIMESTAMP}
- nonce: {0..2^NUM_BITS_NONCE}
- publicKeyX: F
- publicKeyY: F
- feeTokenID: {0..2^NUM_BITS_TOKENID}
- fee: {0..2^NUM_BITS_AMOUNT}
- maxFee: {0..2^NUM_BITS_AMOUNT}
- type: {0..2^8}
- operatorAccountID: {0..2^NUM_BITS_ACCOUNTID}
- root_old: F
- root_A: F
- root_new: F
- account_old: Account
- balance_old: Balance
- account_new: Account
- balance_new: Balance
- accountOperator_old: Account
- balanceOperator_old: Balance
- accountOperator_new: Account
- balanceOperator_new: Balance
- numConditionalTransactions_old: F
- numConditionalTransactions_new: F
- hash: F
- compressedPublicKey: {0..2^254}
- fFee: {0..2^16}
- uFee: F

The following conditions hold:

- accountID != 0
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
- SignatureVerifier(account_old.publicKeyX, account_old.publicKeyY, hash, (type == 0) ? 1 : 0)
- CompressPublicKey(publicKeyX, publicKeyY, compressedPublicKey)
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)
- numConditionalTransactions_new = numConditionalTransactions_old + ((type == 0) ? 0 : 1)
- State update:
  - balance_new.balance = balance_old.balance - uFee.
  - account_new.publicKeyX = publicKeyX and account_new.publicKeyY = publicKeyY
  - account_new.nonce = account_old.nonce + 1
  - Except balance, all fields balance_old -> balance_new remain the same.
  - Except publicKeyX, publicKeyY, nonce and balancesRoot, all fields account_old -> account_new remain the same.
  - balanceOperator_new.balance = balanceOperator_old.balance + uFee.
  - Except balance, all fields balanceOperator_old -> balanceOperator_new remain the same.
  - Except balancesRoot, all fields accountOperator_old -> accountOperator_new remain the same.
- Merkle Path Validity:
  - There is a valid path at feeTokenID from balance_old to account_old.balancesRoot. There is valid path at accountID from account_old to root_old.
  - There is a valid path at feeTokenID from balance_new to account_new.balancesRoot. There is valid path at accountID from account_new to root_A.
  - There is a valid path at feeTokenID from balanceOperator_old to accountOperator_old.balancesRoot. There is valid path at operatorAccountID from accountOperator_old to root_A.
  - There is a valid path at feeTokenID from balanceOperator_new to accountOperator_new.balancesRoot. There is valid path at operatorAccountID from accountOperator_new to root_new.
- da = {
  TransactionType.AccountUpdate,
  owner,
  accountID,
  feeTokenID,
  fFee,
  compressedPublicKey,
  nonce,
  padding_zeros
  }
