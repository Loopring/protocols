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

- AccountState := (
  storage: Storage,
  balanceS: Balance,
  balanceB: Balance,
  account: Account
  )
- AccountOperator := (
  balanceA: Balance,
  balanceB: Balance,
  account: Account
  )
- AccountBalances := (
  balanceA: Balance,
  balanceB: Balance
  )
- State := (
  exchange: F,
  timestamp: F,
  protocolTakerFeeBips: F,
  protocolMakerFeeBips: F,
  numConditionalTransactions: F,
  type: F,

  accountA: AccountState,
  accountB: AccountState,
  operator: AccountOperatorState,
  pool: AccountBalancesState,
  )

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

  DA: F (68\*8 bits)
  )

- OrderMatchingData := (
  amm: {0..1},
  orderFeeBips: {0..2^8},
  fillS: {0..2^NUM_BITS_AMOUNT},
  balanceBeforeS: {0..2^NUM_BITS_AMOUNT},
  balanceBeforeB: {0..2^NUM_BITS_AMOUNT},
  balanceAfterS: {0..2^NUM_BITS_AMOUNT},
  balanceAfterB: {0..2^NUM_BITS_AMOUNT},
  weightS: {0..2^NUM_BITS_AMOUNT},
  weightB: {0..2^NUM_BITS_AMOUNT},
  ammFeeBips: {0..2^NUM_BITS_FEE_BIPS},
  )

- AmmData := (
  inBalanceBefore: {0..2^NUM_BITS_AMOUNT},
  inBalanceAfter: {0..2^NUM_BITS_AMOUNT},
  inWeight: {0..2^NUM_BITS_AMOUNT},
  outBalanceBefore: {0..2^NUM_BITS_AMOUNT},
  outBalanceAfter: {0..2^NUM_BITS_AMOUNT},
  outWeight: {0..2^NUM_BITS_AMOUNT},
  ammFill: {0..2^NUM_BITS_AMOUNT}
  )

## DefaultTxOutput

A valid instance of an DefaultTxOutput statement assures that given an input of:

-

the prover knows an auxiliary input:

- output: TxOutput
- state: State

such that the following conditions hold:

- output.STORAGE_A_ADDRESS = 0
- output.STORAGE_A_DATA = state.accountA.storage.data
- output.TORAGE_A_STORAGEID = state.accountA.storage.storageID

- output.BALANCE_A_S_ADDRESS = 0
- output.BALANCE_A_S_BALANCE = state.accountA.balanceS.balance
- output.BALANCE_A_S_WEIGHTAMM = state.accountA.balanceS.weightAMM

- output.BALANCE_A_B_BALANCE = state.accountA.balanceB.balance

- output.ACCOUNT_A_ADDRESS = 1
- output.ACCOUNT_A_OWNER = state.accountA.account.owner
- output.ACCOUNT_A_PUBKEY_X = state.accountA.account.publicKeyX
- output.ACCOUNT_A_PUBKEY_Y = state.accountA.account.publicKeyY
- output.ACCOUNT_A_NONCE = state.accountA.account.nonce
- output.ACCOUNT_A_FEEBIPSAMM = state.accountA.account.feeBipsAMM

- output.STORAGE_B_ADDRESS] = 0
- output.STORAGE_B_DATA = state.accountB.storage.data
- output.STORAGE_B_STORAGEID = state.accountB.storage.storageID

- output.BALANCE_B_S_ADDRESS = 0
- output.BALANCE_B_S_BALANCE = state.accountB.balanceS.balance
- output.BALANCE_B_B_BALANCE = state.accountB.balanceB.balance

- output.ACCOUNT_B_ADDRESS = 1
- output.ACCOUNT_B_OWNER = state.accountB.account.owner
- output.ACCOUNT_B_PUBKEY_X = state.accountB.account.publicKeyX
- output.ACCOUNT_B_PUBKEY_Y = state.accountB.account.publicKeyY
- output.ACCOUNT_B_NONCE = state.accountB.account.nonce

- output.BALANCE_P_A_BALANCE = state.pool.balanceA.balance
- output.BALANCE_P_B_BALANCE = state.pool.balanceB.balance

- output.BALANCE_O_A_BALANCE = state.oper.balanceA.balance
- output.BALANCE_O_B_BALANCE = state.oper.balanceB.balance

- output.HASH_A = 0
- output.PUBKEY_X_A = state.accountA.account.publicKeyX
- output.PUBKEY_Y_A = state.accountA.account.publicKeyY
- output.SIGNATURE_REQUIRED_A = 1

- output.HASH_B = 0
- output.PUBKEY_X_B = state.accountB.account.publicKeyX
- output.PUBKEY_Y_B = state.accountB.account.publicKeyY
- output.SIGNATURE_REQUIRED_B = 1

- output.NUM_CONDITIONAL_TXS = state.numConditionalTransactions
- output.DA = 0

## DualVariableGadget

This gadget is a simple wrapper around `libsnark::dual_variable_gadget`.

The gadget is used in two different ways:

- To ensure a value matches its bit representation using a specified number of bits
- As a range check: value < 2^n with n the number of bits

## DynamicBalanceGadget and DynamicVariableGadget

This gadget contains a stack of `VariableT` variables.

The gadget is used to make writing circuits easier. A `VariableT` can only have a single value at all times, so using this to represent a mutable value isn't possible.

A single instance of a DynamicVariableGadget can be created which internally contains a list of `VariableT` members. When the value needs to be updated a new `VariableT` is pushed on top of the stack. This way using the latest value is just looking at the `VariableT` at the top of the list.

## UnsafeSub statement

A valid instance of an UnsafeSub statement assures that given an input of:

- value: F
- sub: F

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = value - sub

Notes:

- Does _not_ check for underflow

## UnsafeAdd statement

A valid instance of an UnsafeAdd statement assures that given an input of:

- value: F
- add: F

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = value + add

Notes:

- Does _not_ check for overflow

## UnsafeMul statement

A valid instance of an UnsafeMul statement assures that given an input of:

- valueA: F
- valueB: F

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = valueA \* valueB

Notes:

- Does _not_ check for overflow

## Add statement

A valid instance of an Add statement assures that given an input of:

- A: F
- B: F

with circuit parameters:

- n: unsigned int

the prover knows an auxiliary input:

- result: {0..2^n}

such that the following conditions hold:

- result = UnsafeAdd(A, B)
- result < 2^n

## Sub statement

A valid instance of an Sub statement assures that given an input of:

- A: F
- B: F

with circuit parameters:

- n: unsigned int

the prover knows an auxiliary input:

- result: {0..2^n}

such that the following conditions hold:

- result = UnsafeSub(A, B)
- result < 2^n && result >= 0

Notes:

- Should check for underflow

## Transfer statement

A valid instance of an Transfer statement assures that given an input of:

- from: DynamicVariableGadget
- to: DynamicVariableGadget
- value: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- from = Sub(from, value, NUM_BITS_AMOUNT)
- to = Add(to, value, NUM_BITS_AMOUNT)

## Ternary statement

A valid instance of an Ternary statement assures that given an input of:

- b: {0..1}
- x: F
- y: F

with circuit parameters:

- enforceBitness: bool

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = (b == 1) ? x : y
- if enforceBitness then generate_boolean_r1cs_constraint(b)

Notes:

- Constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## ArrayTernary statement

A valid instance of an ArrayTernary statement assures that given an input of:

- b: {0..1}
- x: F[N]
- y: F[N]

with circuit parameters:

- enforceBitness: bool

the prover knows an auxiliary input:

- result: F[N]

such that the following conditions hold:

- for i in N: result[i] = (b == 1) ? x[i] : y[i]
- if enforceBitness then generate_boolean_r1cs_constraint(b)

## And statement

A valid instance of an And statement assures that given an input of:

- inputs: {0..1}[N]

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = inputs[0] && inputs[1] && ... && inputs[N-1]

Notes:

- All inputs are expected to be boolean
- AND constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## Or statement

A valid instance of an Or statement assures that given an input of:

- inputs: {0..1}[N]

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- result = inputs[0] || inputs[1] || ... || inputs[N-1]

Notes:

- All inputs are expected to be boolean
- OR constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## Not statement

A valid instance of an Not statement assures that given an input of:

- A: {0..1}

with circuit parameters:

- enforceBitness: bool

the prover knows an auxiliary input:

- result: {0..1}

such that the following conditions hold:

- result = 1 - A
- if enforceBitness then generate_boolean_r1cs_constraint(b)

Notes:

- NOT constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## XorArray statement

A valid instance of an XorArray statement assures that given an input of:

- A: {0..1}[N]
- B: {0..1}[N]

the prover knows an auxiliary input:

- result: {0..1}[N]

such that the following conditions hold:

- for i in N: result[i] = A[i] ^ B[i]

Notes:

- All inputs are expected to be boolean
- XOR constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## Equal statement

A valid instance of an Equal statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

- result: {0..1}

such that the following conditions hold:

- result = (A - B == 0) ? 1 : 0

## RequireEqual statement

A valid instance of an RequireEqual statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A == B

## RequireZeroAorB statement

A valid instance of an RequireZeroAorB statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A \* B = 0

## RequireNotZero statement

A valid instance of an RequireNotZero statement assures that given an input of:

- A: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A \* (1/A) = 1

Notes:

- The inverse exists for all numbers except 0
- Constraint logic from https://github.com/daira/r1cs/blob/master/zkproofs.pdf

## RequireNotEqual statement

A valid instance of an RequireNotEqual statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A - B != 0

## LeqGadget

This gadget is a wrapper around `libsnark::comparison_gadget`, exposing `<`, `<=`, `==`, `>=` and `>` for simplicity (and sometimes efficiensy if the same comparison result can be reused e.g. when both `<` and `<=` are needed).

One important limitation of `libsnark::comparison_gadget` is that it does not work for values close to the max field element value. This is an implementation detail as the gadget depends on there being an extra bit at MSB of the valules to be available. As the max field element is ~254 bits, only 253 bits can be used. And because the implementation needs an extra bit we can only compare values that take up at most 252 bits.

This is _not_ checked in the gadget itself, and it depends on the caller to specifiy a valid `n` which is the max number of bits of the value passed into the gadget.

## LtField statement

A valid instance of an LtField statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

- result: {0..1}

such that the following conditions hold:

- result = A < B

Notes:

- Because LeqGadget does not work for certain very large values (values taking up more than 252 bits), we split up the values in two smaller values and do the comparison like that.

## Min statement

A valid instance of an Min statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- (A < B) ? A : B

## Max statement

A valid instance of an Max statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

- result: F

such that the following conditions hold:

- (A < B) ? B : A

## RequireLeq statement

A valid instance of an RequireLeq statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A <= B

## RequireLt statement

A valid instance of an RequireLt statement assures that given an input of:

- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- A < B

## IfThenRequire statement

A valid instance of an IfThenRequire statement assures that given an input of:

- C: {0..1}
- A: {0..1}

the prover knows an auxiliary input:

-

such that the following conditions hold:

- !C || A

## IfThenRequireEqual statement

A valid instance of an IfThenRequireEqual statement assures that given an input of:

- C: {0..1}
- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- IfThenRequire(C, (A == B) ? 1 : 0)

## IfThenRequireNotEqual statement

A valid instance of an IfThenRequireNotEqual statement assures that given an input of:

- C: {0..1}
- A: F
- B: F

the prover knows an auxiliary input:

-

such that the following conditions hold:

- IfThenRequire(C, (A != B) ? 1 : 0)

## MulDivGadget statement

A valid instance of an MulDivGadget statement assures that given an input of:

- value: {0..2^numBitsValue}
- numerator: {0..2^numBitsNumerator}
- denominator: {0..2^numBitsDenominator}

the prover knows an auxiliary input:

- quotient: F
- remainder: F

such that the following conditions hold:

- denominator != 0
- remainder < denominator (with extra check that remainder < 2^numBitsDenominator)
- value _ numerator = denominator _ quotient + remainder

Notes:

- Calculates floor((value \* denominator) / denominator)

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

## PublicData statement

A valid instance of an PublicData statement assures that given an input of:

- data: bits[N]

the prover knows an auxiliary input:

- publicInput: F

such that the following conditions hold:

- publicInput = sha256(data) >> 3

### Description

3 LBS are stripped from the 256-bit hash so that the packed value always fits inside a field element.

## Float statement

Given inputs:

- floatValue_bits: {0..2^(numBitsExponent+numBitsMantissa)}
- decodedValue: F

The following conditions hold:

- decodedValue = floatValue[0..numBitsMantissa[ \* (10^floatValue[numBitsMantissa, numBitsExponent+numBitsMantissa[)

Notes:

- We can only decode floats in the circuits, we never encode floats (which is a heavier operation normally)
- Floats are used to reduce the amount of data we have to put on-chain for amounts.

## Selector statement

A valid instance of an Selector statement assures that given an input of:

- type: F

with circuit parameters:

- n: unsigned int

the prover knows an auxiliary input:

- result: {0..1}[n]

The following conditions hold:

- for i in n: result[i] = (i == type) ? 1 : 0

Notes:

- Sets the variable at position type to 1, all other variables are 0

## Select statement

A valid instance of an Select statement assures that given an input of:

- selector: {0..1}[N]
- values: F[N]

the prover knows an auxiliary input:

- result: F

The following conditions hold:

- for i in n: result = (selector[i] == 1) ? values[i] : result

Notes:

- selector can be assumed to contain exactly a single 1 bit

## ArraySelect statement

A valid instance of an ArraySelect statement assures that given an input of:

- selector: {0..1}[N]
- values: F_array[N]

the prover knows an auxiliary input:

- result: F_array

The following conditions hold:

- for i in n: result = (selector[i] == 1) ? values[i] : result

Notes:

- selector can be assumed to contain exactly a single 1 bit

## OwnerValid statement

A valid instance of an OwnerValid statement assures that given an input of:

- oldOwner: F
- newOwner: F

such that the following conditions hold:

- (oldOwner == newOwner) || (oldOwner == 0)

## SignedAdd statement

A valid instance of an SignedAdd statement assures that given an input of:

- A: SignedF
- B: SignedF

the prover knows an auxiliary input:

- result: SignedF

The following conditions hold:

- result.value = (A.sign == B.sign) ? A.value + B.value : ((A.value < B.value) ? B.value - A.value : A.value - B.value)
- result.sign = result.value == 0 ? 0 : (B.sign == 1 && A.value <= B.value) || (A.sign == 1 && A.value > B.value)

Notes:

- result = A + B

## SignedSub statement

A valid instance of an SignedSub statement assures that given an input of:

- A: SignedF
- B: SignedF

the prover knows an auxiliary input:

- result: SignedF

The following conditions hold:

- result = SignedAdd(A, -B)

## SignedMulDiv statement

A valid instance of an SignedMulDiv statement assures that given an input of:

- value: SignedF{0..2^numBitsValue}
- numerator: SignedF{0..2^numBitsNumerator}
- denominator: {0..2^numBitsDenominator}

the prover knows an auxiliary input:

- res: SignedF
- quotient: F
- sign: {0..1}

such that the following conditions hold:

- quotient = MulDiv(value.value, numerator.value, denominitor)
- sign = (quotient == 0) ? 0 : ((value.sign == numerator.sign) ? 1 : 0)

## Power statement

A valid instance of an Power statement assures that given an input of:

- \_x: F
- \_y: F

with circuit parameters:

- numIterations: unsigned int

the prover knows an auxiliary input:

- result: F
- x: F
- sum0: F

such that the following conditions hold:

- x = BASE_FIXED - \_x
- sum[0] = BASE_FIXED \* BASE_FIXED
- sum[1] = sum[0] - (x \* y)
- bn[1] = BASE_FIXED
- xn[1] = x
- cn[1] = y
- for i in 2..numIterations:
  - bn[i] = bn[i-1] + BASE_FIXED
  - vn[i] = y - bn[i-1]
  - xn[i] = (xn[i-1] \* x) / BASE_FIXED
  - cn[i] = (cn[i-1] \* vn[i]) / bn[i]
  - tn[i] = SignedF((i+1)%2, xn[i]) \* cn[i]
  - sum[i] = sum[i-1] + tn[i]
  - cn[i] < 2^NUM_BITS_AMOUNT
- result = sum[numIterations-1] / BASE_FIXED
- result < 2^NUM_BITS_AMOUNT
- result.sign == 1

Notes:

- Results should never be able to overflow or underflow
- Power approximiation formule as found here: https://docs.balancer.finance/protocol/index/approxing

### Description

Calculates [0, 1]\*\*[0, inf) using an approximation. The closer the base is to 1, the higher the accuracy.
The result is enforced to be containable in NUM_BITS_AMOUNT bits.
The higher the number of iterations, the higher the accuracy (and the greater the cost).

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

## UpdateBalance statement

A valid instance of an UpdateBalance statement assures that given an input of:

- root_before: F
- address: {0..2^NUM_BITS_TOKEN}
- before: Balance
- after: Balance

the prover knows an auxiliary input:

- root_after: F
- proof: F[3 * TREE_DEPTH_TOKENS]

such that the following conditions hold:

- hash_before = PoseidonHash_t5f6p52(
  before.balance,
  before.weightAMM,
  before.storageRoot
  )
- hash_after = PoseidonHash_t5f6p52(
  after.balance,
  after.weightAMM,
  after.storageRoot
  )
- MerklePathCheck(TREE_DEPTH_TOKENS, address, hash_before, root_before, proof)
- root_after = MerklePath(TREE_DEPTH_TOKENS, address, hash_after, proof)

## UpdateStorage statement

A valid instance of an UpdateStorage statement assures that given an input of:

- root_before: F
- address: {0..2^NUM_BITS_STORAGEID}
- before: Storage
- after: Storage

the prover knows an auxiliary input:

- root_after: F
- proof: F[3 * TREE_DEPTH_STORAGE]

such that the following conditions hold:

- hash_before = PoseidonHash_t5f6p52(
  before.data,
  before.storageID
  )
- hash_after = PoseidonHash_t5f6p52(
  after.data,
  after.storageID
  )
- MerklePathCheck(TREE_DEPTH_STORAGE, address, hash_before, root_before, proof)
- root_after = MerklePath(TREE_DEPTH_STORAGE, address, hash_after, proof)

## CompressPublicKey statement

A valid instance of an CompressPublicKey statement assures that given an input of:

- publicKeyX: F
- publicKeyY: F

the prover knows an auxiliary input:

- compressedPublicKey_bits: {0..2^256}

The following conditions hold:

If publicKeyY != 0:

- publicKeyY = compressedPublicKey_bits[0..254[
- compressedPublicKey_bits[254] = 0
- publicKeyX = (compressedPublicKey_bits[255] == 1 ? -1 : 1) \* sqrt((y\*y - 1) / ((JubJub.D \* y\*y) - JubJub.A)

If publicKeyY == 0:

- compressedPublicKey_bits[0..256[ = 0

Notes:

- sqrt always needs to return the positive root, which is defined by root < 0 - root. Otherwise the prover can supply either the negative root or the positive root as a valid result of sqrt when the constraint is defined as x == y \* y == -y \* -y.
- A special case is to allow publicKeyX == publicKeyY == 0, which isn't a valid point. This allows disabling the ability to sign with EdDSA with the account).
- See https://ed25519.cr.yp.to/eddsa-20150704.pdf

## EdDSA_HashRAM_Poseidon statement

A valid instance of an EdDSA_HashRAM_Poseidon statement assures that given an input of:

- rX: F
- rY: F
- aX: F
- aY: F
- message: F

the prover knows an auxiliary input:

- hash: F

The following conditions hold:

- hash_bits = hash_packed
- hash = PoseidonHash_t6f6p52(
  rX,
  rY,
  aX,
  aY,
  message
  )

## EdDSA_Poseidon statement

A valid instance of an EdDSA_Poseidon statement assures that given an input of:

- aX: F
- aY: F
- rX: F
- rY: F
- s: F[]
- message: F

the prover knows an auxiliary input:

- result: {0..1}
- hash: F
- hashRam: F[]
- atX: F
- atY: F

The following conditions hold:

- PointValidator(aX, aY)
- hashRAM = EdDSA_HashRAM_Poseidon(rX, rY, aX, aY, s)
- (atX, atY) = ScalarMult(aX, aY, hashRAM)
- result = (fixed_base_mul(s) == PointAdder(rX, rY, atX, atY))

Notes:

- Based on `PureEdDSA` in ethsnarks

## SignatureVerifier statement

Given inputs:

- publicKeyX: F
- publicKeyY: F
- message: F
- required: {0..1}

the prover knows an auxiliary input:

- result
- rX: F
- rY: F
- s: F[]

The following conditions hold:

- result = EdDSA_Poseidon(publicKeyX, publicKeyY, rX, rY, s, message)
- if required == 1 then valid == 1

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

- output = DefaultTxOutput(state)
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
  )
- OwnerValid(account_old.owner, owner)
- timestamp < validUntil
- fee <= maxFee
- CompressPublicKey(publicKeyX, publicKeyY, compressedPublicKey)
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)

- output = DefaultTxOutput(state)
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

- output = DefaultTxOutput(state)
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

- output = DefaultTxOutput(state)

Notes:

- Should do no to the Merkle tree or any other intermediate block values (like numConditionalTransactions)

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
  )
- owner = (accountID == 0) ? 0 : state.accountA.account.owner
- timestamp < validUntil (RequireLtGadget)
- fee <= maxFee (RequireLeqGadget)
- if type == 2 then amount = balance_old.balance
- if type == 3 then amount = 0

- Nonce(state.accountA.storage, storageID, (txType == TransactionType.Withdraw && (type == 0 || type == 1)))
- Float(fFee, uFee)
- RequireAccuracy(uFee, fee)

- output = DefaultTxOutput(state)
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

- output = DefaultTxOutput(state)
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

- (fillAmountS \* amountB \* 1000) <= (fillAmountB \* amountS \* 1001) (RequireLeqGadget)
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

## SpotPriceAMM statement

A valid instance of an SpotPriceAMM statement assures that given an input of:

- balanceIn: {0..2^NUM_BITS_AMOUNT}
- weightIn: {0..2^NUM_BITS_AMOUNT}
- balanceOut: {0..2^NUM_BITS_AMOUNT}
- weightOut: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- result: F
- numer: F
- denom: F
- ratio: F
- invFeeBips: F

such that the following conditions hold:

- numer = balanceIn \* weightOut
- denom = balanceOut \* weightIn
- ratio = (numer \* BASE_FIXED) / denom
- invFeeBips = BASE_BIPS - feeBips
- result = (ratio \* BASE_BIPS) / invFeeBips

## CalcOutGivenInAMM statement

A valid instance of an CalcOutGivenInAMM statement assures that given an input of:

- balanceIn: {0..2^NUM_BITS_AMOUNT}
- weightIn: {0..2^NUM_BITS_AMOUNT}
- balanceOut: {0..2^NUM_BITS_AMOUNT}
- weightOut: {0..2^NUM_BITS_AMOUNT}
- feeBips: {0..2^NUM_BITS_FEE_BIPS}
- amountIn: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- result: F
- weightRatio: {0..2^NUM_BITS_AMOUNT}
- fee: F
- y: F
- p: F

such that the following conditions hold:

- weightRatio = (weightIn \* BASE_FIXED) / weightOut
- fee = amountIn \* feeBips / BASE_BIPS
- y = (balanceIn \* BASE_FIXED) / (balanceIn + (amountIn - fee))
- p = power(y, weightRatio)
- result = balanceOut \* (BASE_FIXED - p) / BASE_FIXED

## RequireAMMFills statement

A valid instance of an RequireAMMFills statement assures that given an input of:

- data: OrderMatchingData
- fillB: {0..2^NUM_BITS_AMOUNT}

the prover knows an auxiliary input:

- ammData: AmmData
- maxFillS: F
- price_before: F
- price_after: F

such that the following conditions hold:

- ammData = (data.amm == 1) ?
  AmmData(data.balanceBeforeB, data.balanceAfterB, data.weightB, data.balanceBeforeS, data.balanceAfterS, data.weightS, fillB) :
  AmmData(FIXED_BASE, FIXED_BASE, FIXED_BASE, FIXED_BASE, FIXED_BASE, FIXED_BASE, 0)

- if data.amm == 1 then data.orderFeeBips == 0
- if data.amm == 1 then ammData.inWeight != 0
- if data.amm == 1 then ammData.outWeight != 0

- maxFillS = CalcOutGivenInAMM(ammData.inWeight, ammData.outBalanceBefore, ammData.outWeight, data.ammFeeBips, ammData.ammFill)
- if data.amm == 1 then data.fillS <= maxFillS
- price_before = SpotPriceAMM(ammData.inBalanceBefore, ammData.inWeight, ammData.outBalanceBefore, ammData.outWeight, data.ammFeeBips)
- price_after = SpotPriceAMM(ammData.inBalanceAfter, ammData.inWeight, ammData.outBalanceAfter, ammData.outWeight, data.ammFeeBips)
- if data.amm == 1 price_before <= price_after

## ValidateAMM statement

A valid instance of an ValidateAMM statement assures that given an input of:

- dataA: OrderMatchingData
- dataB: OrderMatchingData

the prover knows an auxiliary input:

-

such that the following conditions hold:

- RequireAMMFills(dataA, dataB.fillS)
- RequireAMMFills(dataB, dataA.fillS)

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

- ValidateAMM(
  OrderMatchingData(
  orderA.feeBips,
  uFillS_A,
  state.accountA.balanceS.balance,
  state.accountA.balanceB.balance,
  output.BALANCE_A_S_BALANCE,
  output.BALANCE_A_B_BALANCE,
  state.accountA.balanceS.weightAMM,
  state.accountA.balanceB.weightAMM,
  state.accountA.account.feeBipsAMM
  ),
  OrderMatchingData(
  orderB.feeBips,
  uFillS_B,
  state.accountB.balanceS.balance,
  state.accountB.balanceB.balance,
  output.BALANCE_B_S_BALANCE,
  output.BALANCE_B_B_BALANCE,
  state.accountB.balanceS.weightAMM,
  state.accountB.balanceB.weightAMM,
  state.accountB.account.feeBipsAMM
  ),
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

- root_updateStorage_A = StorageUpdate(
  state.accountA.balanceS.storageRoot,
  output.STORAGE_A_ADDRESS,
  state.accountA.storage,
  (output.STORAGE_A_DATA, output.STORAGE_A_STORAGEID)
  )
- root_updateBalanceS_A = BalanceUpdate(
  state.accountA.account.balancesRoot,
  output.BALANCE_A_S_ADDRESS,
  state.accountA.balanceS,
  (output.BALANCE_A_S_BALANCE, output.BALANCE_A_S_WEIGHTAMM, root_updateStorage_A)
  )
- root_updateBalanceB_A = BalanceUpdate(
  root_updateBalanceS_A,
  output.BALANCE_B_S_ADDRESS,
  state.accountA.balanceB,
  (output.BALANCE_A_B_BALANCE, state.accountA.balanceB.weightAMM, state.accountA.balanceB.storageRoot)
  )
- root_updateAccount_A = AccountUpdate(
  root_old,
  output.ACCOUNT_A_ADDRESS,
  state.accountA.account,
  (output.ACCOUNT_A_OWNER, output.ACCOUNT_A_PUBKEY_X, output.ACCOUNT_A_PUBKEY_Y, output.ACCOUNT_A_NONCE, output.ACCOUNT_A_FEEBIPSAMM, root_updateBalanceB_A)
  )

- root_updateStorage_B = StorageUpdate(
  state.accountB.balanceS.storageRoot,
  output.STORAGE_B_ADDRESS,
  state.accountB.storage,
  (output.STORAGE_B_DATA, output.STORAGE_B_STORAGEID)
  )
- root_updateBalanceS_B = BalanceUpdate(
  state.accountB.account.balancesRoot,
  output.BALANCE_B_S_ADDRESS,
  state.accountB.balanceS,
  (output.BALANCE_B_S_BALANCE, state.accountB.balanceS.weightAMM, root_updateStorage_B)
  )
- root_updateBalanceB_B = BalanceUpdate(
  root_updateBalanceS_B,
  output.BALANCE_A_S_ADDRESS,
  state.accountB.balanceB,
  (output.BALANCE_B_B_BALANCE, state.accountB.balanceB.weightAMM, state.accountB.balanceB.storageRoot)
  )
- root_updateAccount_B = AccountUpdate(
  root_updateAccount_A,
  output.ACCOUNT_B_ADDRESS,
  state.accountB.account,
  (output.ACCOUNT_B_OWNER, output.ACCOUNT_B_PUBKEY_X, output.ACCOUNT_B_PUBKEY_Y, output.ACCOUNT_B_NONCE, state.accountB.account.feeBips, root_updateBalanceB_B)
  )

- root_updateBalanceB_O = BalanceUpdate(
  state.operator.account.balancesRoot,
  output.BALANCE_A_S_ADDRESS,
  state.operator.balanceB,
  (output.BALANCE_O_B_BALANCE, state.operator.balanceB.weightAMM, state.operator.balanceB.storageRoot)
  )
- root_updateBalanceA_O = BalanceUpdate(
  root_updateBalanceB_O,
  output.BALANCE_B_S_ADDRESS,
  state.operator.balanceS,
  (output.BALANCE_O_A_BALANCE, state.operator.balanceS.weightAMM, state.operator.balanceS.storageRoot)
  )
- root_new = AccountUpdate(
  root_updateAccount_B,
  operatorAccountID,
  state.operator.account,
  (state.operator.account.owner, state.operator.account.publicKeyX, state.operator.account.publicKeyY, state.operator.account.nonce, state.operator.account.feeBips, root_updateBalanceA_O)
  )

- root_updateBalanceB_P = BalanceUpdate(
  protocolBalancesRoot_old,
  output.BALANCE_A_S_ADDRESS,
  state.pool.balanceB,
  (output.BALANCE_P_B_BALANCE, 0, EMPTY_STORAGE_ROOT)
  )
- protocolBalancesRoot_new = BalanceUpdate(
  root_updateBalanceB_P,
  output.BALANCE_B_S_ADDRESS,
  state.operator.balanceB,
  (output.BALANCE_P_A_BALANCE, 0, EMPTY_STORAGE_ROOT)
  )

### Description

This gadget executes the required logic for the transaction (by executing the logic for each transactions type and then selecting the right output) and using the output of the transaction to do all shared and heavy operations: signature checking and Merkle tree updates. By sharing these operations between all transaction types the resulting circuit is much more efficient than if we would simply do these operations for all transactions types all times (as the number of constraints produced would simply stack on top of each other).

To do this, all data that could be updated in any of the transactions is stored in a shared output data interface. We then always update all output data, even if it remains the same.

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
  Transaction[N-1].newAccountsRoot,
  0,
  (accountP.owner, accountP.publicKey.x, accountP.publicKey.y, accountP.nonce, accountP.feeBipsAMM, accountP.balancesRoot),
  (accountP.owner, accountP.publicKey.x, accountP.publicKey.y, accountP.nonce, accountP.feeBipsAMM, Transaction[N-1].getNewProtocolBalancesRoot())
  )
- root_O = UpdateAccount(
  root_P,
  operatorAccountID,
  (accountO.owner, accountO.publicKey.x, accountO.publicKey.y, accountO.nonce, accountO.feeBipsAMM, accountO.balancesRoot),
  (accountO.owner, accountO.publicKey.x, accountO.publicKey.y, accountO.nonce + 1, accountO.feeBipsAMM, accountO.balancesRoot)
  )
- merkleRootAfter = root_O

### Description

Batches multiple transactions together in a block. All public input is hashed to the single field element publicInput, this makes verifying the proof more efficient.

The operator is required to sign the block. This is needed because the operator pays the protocol fees.
