**Important**! There are some very minor differences between the implementation and the docs (merkle tree depths, operatorAccountID placement in onchain calldata). The implementation will be updated to reflect the docs as soon as possible.

## Merkle tree format

![Merkle Tree](https://i.imgur.com/RcoayPR.png)

All Merkle trees are currently stored in a sparse Merkle tree format. The Accounts Merkle tree (the top part) does **NOT** need to be stored like that. For the circuits it does not matter if the Merkle tree is sparse or not. The only thing important for the circuits is that the depth of the leafs is always the same. Accounts are added to the tree one after the other. The same is not true for the sub-Merkle trees. Here any leaf can be used at any time so the implementation should use a sparse Merkle tree.

To verify data is stored in the Merkle tree a [Merkle proof](https://medium.com/crypto-0-nite/merkle-proofs-explained-6dd429623dc5) is used. This is key to how the circuits work.

The Merkle tree currently uses MiMC/e7r91 for all hashes. 

Helpful links:
- A test implementation of a [sparse Merkle tree in Python](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/operator/sparse_merkle_tree.py)
- [EdDSA implementation in Python](https://github.com/HarryR/ethsnarks/blob/master/ethsnarks/eddsa.py)
- [MiMC implementation in Python](https://github.com/HarryR/ethsnarks/blob/master/ethsnarks/mimc.py)
- [Pedersen implementation in Python](https://github.com/HarryR/ethsnarks/blob/master/ethsnarks/pedersen.py)
- [EdDSA implementation in JS](https://github.com/iden3/circomlib/blob/master/src/eddsa.js)
- [MiMC implementation in JS](https://github.com/iden3/circomlib/blob/master/src/mimc7.js)
- [Pedersen implementation in JS](https://github.com/iden3/circomlib/blob/master/src/pedersenHash.js)


### Leaf nodes

 Note that MiMC works directly on field elements, data is not packed together as small as possible in a single bitstream.

- Account leaf: `MiMC([publicKeyX, publicKeyY, nonce, balancesRoot], 0)`
- Balance leaf: `MiMC([balance, tradeHistoryRoot], 0)`
- TradeHistory leaf: `MiMC([filled, cancelled, orderID], 0)`

### Non-leaf nodes

`MiMC([left, right], depth)`

Different __initial values__ are used on different levels of the Merkle tree:

```
IVs[0] = 149674538925118052205057075966660054952481571156186698930522557832224430770;
IVs[1] = 9670701465464311903249220692483401938888498641874948577387207195814981706974;
IVs[2] = 18318710344500308168304415114839554107298291987930233567781901093928276468271;
IVs[3] = 6597209388525824933845812104623007130464197923269180086306970975123437805179;
IVs[4] = 21720956803147356712695575768577036859892220417043839172295094119877855004262;
IVs[5] = 10330261616520855230513677034606076056972336573153777401182178891807369896722;
IVs[6] = 17466547730316258748333298168566143799241073466140136663575045164199607937939;
IVs[7] = 18881017304615283094648494495339883533502299318365959655029893746755475886610;
IVs[8] = 21580915712563378725413940003372103925756594604076607277692074507345076595494;
IVs[9] = 12316305934357579015754723412431647910012873427291630993042374701002287130550;
IVs[10] = 18905410889238873726515380969411495891004493295170115920825550288019118582494;
IVs[11] = 12819107342879320352602391015489840916114959026915005817918724958237245903353;
IVs[12] = 8245796392944118634696709403074300923517437202166861682117022548371601758802;
IVs[13] = 16953062784314687781686527153155644849196472783922227794465158787843281909585;
IVs[14] = 19346880451250915556764413197424554385509847473349107460608536657852472800734;
IVs[15] = 14486794857958402714787584825989957493343996287314210390323617462452254101347;
IVs[16] = 11127491343750635061768291849689189917973916562037173191089384809465548650641;
IVs[17] = 12217916643258751952878742936579902345100885664187835381214622522318889050675;
IVs[18] = 722025110834410790007814375535296040832778338853544117497481480537806506496;
IVs[19] = 15115624438829798766134408951193645901537753720219896384705782209102859383951;
IVs[20] = 11495230981884427516908372448237146604382590904456048258839160861769955046544;
IVs[21] = 16867999085723044773810250829569850875786210932876177117428755424200948460050;
IVs[22] = 1884116508014449609846749684134533293456072152192763829918284704109129550542;
IVs[23] = 14643335163846663204197941112945447472862168442334003800621296569318670799451;
IVs[24] = 1933387276732345916104540506251808516402995586485132246682941535467305930334;
IVs[25] = 7286414555941977227951257572976885370489143210539802284740420664558593616067;
IVs[26] = 16932161189449419608528042274282099409408565503929504242784173714823499212410;
IVs[27] = 16562533130736679030886586765487416082772837813468081467237161865787494093536;
IVs[28] = 6037428193077828806710267464232314380014232668931818917272972397574634037180;
```

## Block file format

The prover program expects a block as input in the JSON format.

The data is stored in the following format for the different block types.

### General data formats

```
TREE_DEPTH_ACCOUNTS = 20
TREE_DEPTH_BALANCES = 8
TREE_DEPTH_TRADEHISTORY = 14

Proof(depth)
{
    # Merkle inclusion proof data
    data: string[depth],
}

TradeHistoryLeaf
{
    filled: string,
    cancelled: number,
    orderID: number,
}

BalanceLeaf
{
    balance: string,
    tradingHistoryRoot: string,
}

Account
{
    publicKeyX: string,
    publicKeyY: string,
    nonce: number;
    balancesRoot: string,
}

BalanceUpdate
{
    tokenID: number,
    proof: Proof(TREE_DEPTH_BALANCES),
    rootBefore: string,
    rootAfter: string,
    before: BalanceLeaf,
    after: BalanceLeaf,
}

TradeHistoryUpdate
{
    orderID: number,
    proof: Proof(TREE_DEPTH_TRADEHISTORY),
    rootBefore: string,
    rootAfter: string,
    before: TradeHistoryLeaf,
    after: TradeHistoryLeaf,
};

AccountUpdate
{
    accountID: number,
    proof: Proof(TREE_DEPTH_ACCOUNTS),
    rootBefore: string,
    rootAfter: string,
    before: Account,
    after: Account,
}

Signature
{
    Rx: string,
    Ry: string,
    s: string,
}

```

### Ring Settlement

```
Order
{
    publicKeyX: string;
    publicKeyY: string;
    dualAuthPublicKeyX: string,
    dualAuthPublicKeyY: string,
    exchangeID: number,
    orderID: number,
    accountID: number,
    walletAccountID: number,
    tokenS: number,
    tokenB: number,
    tokenF: number,
    amountS: string,
    amountB: string,
    amountF: string,

    allOrNone: number,
    validSince: number,
    validUntil: number,
    walletSplitPercentage: number,
    waiveFeePercentage: number,

    signature: Signature,

    # The data in the trade history of tokenS before they are updated
    tradeHistoryFilled: string,
    tradeHistoryCancelled: number,
    tradeHistoryOrderID: number,

    # The balances of tokenS, tokenB and tokenF before they are updated in
    # the ring settlement logic
    balanceS: string,
    balanceB: string,
    balanceF: string,
}

class Ring
{
    orderA: Order,
    orderB: Order,

    # Expected fill amounts, will be recalculated in the circuit
    fillS_A: string,
    fillB_A: string,
    fillF_A: string,
    fillS_B: string,
    fillB_B: string,
    fillF_B: string,
    margin: string,

    minerAccountID: number,
    feeRecipientAccountID: number,
    tokenID: number,
    fee: string,
    nonce: number,

    minerSignature: Signature,
    dualAuthASignature: Signature,
    dualAuthBSignature: Signature,
}

RingSettlement
{
    ring: Ring,

    # The starting merkle root
    accountsMerkleRoot: string,

    # Trade history update data of the orders
    tradeHistoryUpdate_A: TradeHistoryUpdate,
    tradeHistoryUpdate_B: TradeHistoryUpdate,

    # OrderA:
    # Balance update data for tokenS, tokenB and tokenF
    # Account update data
    balanceUpdateS_A: BalanceUpdate,
    balanceUpdateB_A: BalanceUpdate,
    balanceUpdateF_A: BalanceUpdate,
    accountUpdate_A: AccountUpdate,

    # OrderB:
    # Balance update data for tokenS, tokenB and tokenF
    # Account update data
    balanceUpdateS_B: BalanceUpdate,
    balanceUpdateB_B: BalanceUpdate,
    balanceUpdateF_B: BalanceUpdate,
    accountUpdate_B: AccountUpdate,

    # WalletA:
    # Balance update data for tokenF of orderA
    # Account update data
    balanceUpdateA_W: BalanceUpdate,
    accountUpdateA_W: AccountUpdate,

    # WalletB:
    # Balance update data for tokenF of orderB
    # Account update data
    balanceUpdateB_W: BalanceUpdate,
    accountUpdateB_W: AccountUpdate,

    # Fee-recipient:
    # Balance update data for tokenF of orderA and tokenF of orderB
    # Account update data
    balanceUpdateA_F: BalanceUpdate,
    balanceUpdateB_F: BalanceUpdate,
    accountUpdate_F: AccountUpdate,

    # Ring-matcher:
    # Balance update data for tokenS of orderA (margin) and token used for paying the operator
    # Account update data
    balanceUpdateM_M: BalanceUpdate,
    balanceUpdateO_M: BalanceUpdate,
    accountUpdate_M: AccountUpdate,

    # Balance update data for fee payment by the ring-matcher
    balanceUpdateF_O: BalanceUpdate,
}

RingSettlementBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Timestamp used in this block
    timestamp: number,

    # Operator:
    # Account update data
    operatorAccountID: number,
    accountUpdate_O: AccountUpdate,

    ringSettlements: RingSettlement[],
}
```

### Deposit

```
Deposit
{
    balanceUpdate: BalanceUpdate,
    accountUpdate: AccountUpdate,
}

DepositBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Accumulated hash of starting onchain request
    startHash: string;

    # Index of onchain request
    startIndex: number,
    # Number of onchain requests processed in this block
    count: number,

    deposits: Deposit[],
}
```

### On-chain Withdrawal

```
OnchainWithdrawal
{
    # Amount requested
    amount: string,

    balanceUpdate: BalanceUpdate,
    accountUpdate: AccountUpdate,
}

OnchainWithdrawalBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Accumulated hash of starting onchain request
    startHash: string;

    # Index of onchain request
    startIndex: number,
    # Number of onchain requests processed in this block
    count: number,

    withdrawals: OnchainWithdrawal[],
}
```

### Off-chain Withdrawal

```
OffchainWithdrawal
{
    # Offchain request data
    amount: string,
    fee: string,
    walletSplitPercentage: number,
    signature: Signature,

    # User:
    # Balance update data for tokenF and token withdrawn
    # Account update data
    balanceUpdateF_A: BalanceUpdate,
    balanceUpdateW_A: BalanceUpdate;
    accountUpdate_A: AccountUpdate;

    # Wallet:
    # Balance update data for tokenF and token withdrawn
    # Account update data
    balanceUpdateF_W: BalanceUpdate,
    accountUpdate_W, AccountUpdate,

    # Operator:
    # Balance update data for tokenF
    balanceUpdateF_O: BalanceUpdate,
}

OffchainWithdrawalBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Operator:
    # Account update data
    operatorAccountID: number,
    accountUpdate_O: AccountUpdate,

    withdrawals: OffchainWithdrawal[],
}
```

### Cancellation

```
Cancellation
{
    # Offchain request data
    fee: string,
    walletSplitPercentage: number,
    signature: Signature,

    # User:
    # Trade history update data
    # Balance update data for tokenF and token withdrawn
    # Account update data
    tradeHistoryUpdate_A: TradeHistoryUpdate;
    balanceUpdateF_A: BalanceUpdate,
    balanceUpdateW_A: BalanceUpdate;
    accountUpdate_A: AccountUpdate;

    # Wallet:
    # Balance update data for tokenF and token withdrawn
    # Account update data
    balanceUpdateF_W: BalanceUpdate,
    accountUpdate_W, AccountUpdate,

    # Operator:
    # Balance update data for tokenF
    balanceUpdateF_O: BalanceUpdate,
}

CancellationBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Operator:
    # Account update data
    operatorAccountID: number,
    accountUpdate_O: AccountUpdate,

    cancels: Cancellation[],
}
```

## On-chain data-availability format

Please see the [docs in the code](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/contracts/iface/IExchange.sol) for `commitBlock` so that this information is documented in a single place.

## Offchain requests

Please see the [design doc](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/DESIGN.md) so that this information is documented in a single place.

These requests are batched in blocks by the operator. The operator creates a block file which can be used as the input for the prover.

## Offchain request logic

Offchain requests are used to update the Merkle tree in a valid way, otherwise a proof cannot be generated.

The logic required is in general pretty simple. For code references, please refer to
- The [simulator code](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/test/simulator.ts) used for validation. This is the easiest to read, but does not contain code to generate the Merkle proofs.
- The [operator code](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/operator/state.py) used for creating the blocks in the tests. Contains all the code needed to create valid blocks.
- The [circuit code](https://github.com/Loopring/protocols/tree/master/packages/loopring_v3/circuit/Circuits)

### Data format used in tests to batch requests in a block

This format is completely implementation dependent. It's not even needed if the service bundling the requests also creates the block. In that case these requests will simply be stored somewhere in memory and will be used to create a block and update the Merkle tree. Note that for the tests we currently do all signing of the data while creating a block, this will obviously not be how a real system works, the requests will need to have a signature. See the design doc for more realistic data sharing formats.

#### Deposits

```
Deposit
{
    accountID: number,
    secretKey: string,      # For tests!
    publicKeyX: string,
    publicKeyY: string,
    tokenID: number,
    amount: number,
}

{
    startHash: string,
    startIndex: number,
    count: number,
    deposits: Deposit[],
}
```

#### Cancellations

```
Cancellation
{
    accountID: number,
    orderTokenID: number,
    orderID: number,
    walletAccountID: number,
    feeTokenID: number,
    fee: string,
    walletSplitPercentage: number,
}

{
    operatorAccountID: number,
    cancels: Cancellation[],
}

```

#### Withdrawals

```
Withdrawal
{
    accountID: number,
    tokenID: number,
    amount: string,
    walletAccountID: number,
    feeTokenID: number,
    fee: string,
    walletSplitPercentage: number,
}

{
    operatorAccountID: number,
    startHash: string,
    startIndex: number,
    count: number,
    withdrawals: Withdrawal[],
}

```

#### Ring Settlements

```

Order
{
    exchangeID: number,
    orderID: number,
    accountID: number,
    walletAccountID: number,
    dualAuthPublicKeyX: string,
    dualAuthPublicKeyY: string,
    dualAuthSecretKey: string,
    tokenIdS: number,
    tokenIdB: number,
    tokenIdF: number,
    amountS: string,
    amountB: string,
    amountF: string,
    allOrNone: boolean,
    validSince: number,
    validUntil: number,
    walletSplitPercentage: number,
    waiveFeePercentage: number,
}

Ring
{
    minerAccountID: number,
    feeRecipientAccountID: number,
    tokenID: number,
    fee: string,
    orderA: Order,
    orderB: Order,
}

{
    operatorAccountID: number,
    timestamp: number,
    exchangeID: number,
    rings: Ring[],
}

```
