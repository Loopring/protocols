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

- Account leaf: `MiMC([publicKeyX, publicKeyY, nonce, balancesRoot], 1)`
- Balance leaf: `MiMC([balance, tradeHistoryRoot], 1)`
- TradeHistory leaf: `MiMC([filled, cancelled, orderID], 1)`

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

### Default hashes

#### Trading History
```
TradeHistory leaf: 0x101c08baddce1162a9eecedb95724e61d738f1765a8565092a266e29cf55fccf
= MiMC([0, 0, 0], 1)

hash[0]: 0x1fb5afd6afc9a69db34b1b84ebce3c2faca1bf53eeb45c721e82d3eb47533adb
hash[1]: 0xe657badeb10bedad4c62d67d80780fe16dd9f8a0649cc23cebd100f23761042
hash[2]: 0x1ae22faaf2ca9ec385d9a9a68c08d8adf757c416acd54049bffb6914a6d20640
hash[3]: 0x2c7c5a0aa17c0062366aded369cff7650eb475544247bbb71939db4b9c393e95
hash[4]: 0xbaf7d8d70cc63a01fd78d1096840434847cb73b26971d2fe6135afc69c55d6f
hash[5]: 0x1c384e244f70d17e2a203d2af0f07c1da99566f7b86af060a7b4ffeb034ad6be
hash[6]: 0x148cd71daaae6f0b5e14e4f1f34f04a9a94c1aec2430625ae609549aa1cd3572
hash[7]: 0x159aed844664c9e506ddcbdb89b600e886fa81f2ace1f33f550c17822b705146
hash[8]: 0x1b64acbee6baee5473bc696e70124d8d4e9fc6a17fa9fa63a7d1b8046549148
hash[9]: 0x2bd42844604b6fde8629bb29b4b55b4afa7d2e4271e6957cb93dddf5b99a97e4
hash[10]: 0xe0b9177d265369cebada4983226d9a865926edba0b86fb537f45431d738f46b
hash[11]: 0x2b094012990c8696cb5feda36c688f7b128732c8e966e96f34cb322c44854273
hash[12]: 0xc7b25ac21f78ce888e550faed69b2cb1a4b802a369a812cc7d9b137e12ccc49
hash[13] (root): 0x6a758cbc35092b45c88dbae5073a4e23f360e609358d4f5c10a656535523b5
```

#### Balances
```
Balance leaf: 0x278bc8958f6990b142721c8fdc3edab2b7d1eac70caf0d7c5e781017e0381d56
= MiMC([0, 0x6a758cbc35092b45c88dbae5073a4e23f360e609358d4f5c10a656535523b5], 1)

hash[0]: 0x24c571ee826cfc8274e3642b6b06cd2a1a40a7433bb27407da3f1e30477b9a4
hash[1]: 0x11e5a142716cff32f358f04c649e5a49d6bbe156f5785453a921ce9fabb27bd2
hash[2]: 0x25ffdceae62f2d9aff9172003a975da080b34f36c9d5662b9e3b55acad7f1157
hash[3]: 0x3d5376b72fb6e57b0633f6e437f8c6f9e06674e4d775d1645c061f28abfd8e4
hash[4]: 0x6dcb91737af1a7a6533ef32c2fc442141bb36036c381857582f74fb40ee87e1
hash[5]: 0x2c83417340ba2197a4d32305dbfe2d4ad980a994ab69f7ac1610cd63859ff2e8
hash[6]: 0x2c3ea061b73b4edd2bbea02cc6a2b24512c11f6d3b363ccf917bb1bf55c22788
hash[7] (root): 0x2536e7e72380a3e82ef39b3dcf030980ff9fdef24e1249fbe94f18abf47f89bb
```

#### Accounts
```
Account leaf: 0x18594432270e9445306e567606f43eb575987c84a6b91f61038e2b6c5f424a0c
= MiMC(["0", "0", 0, 0x2536e7e72380a3e82ef39b3dcf030980ff9fdef24e1249fbe94f18abf47f89bb], 1)

hash[0]: 0x21b95d92a3767a01b6c4e6ec3971ba20e75b7191886b32adc6cffc270c1d9c65
hash[1]: 0x12e9d196cdcb86268790e90919aeb846c9e6978962239f5f2ace96a381aaa732
hash[2]: 0x18fa8da025543d9f3ae2a888cd815fe11c8efb4d5de7073c01ff6deec51b6572
hash[3]: 0x11fd20e59522f42fa06807161608b438b118391a423658f2936bb356d2cc563b
hash[4]: 0x2e134b528913fbb81ec64191569b6148c3337976b677779507de28bc76cbce8f
hash[5]: 0x2a62758f4191b12f03272d7d38f208f46a15f232bce78da4b23c1c14de1b49dc
hash[6]: 0x23175ab5489b507acacdc7b8e822c61cbda187d57fbbe321d86d19521183526a
hash[7]: 0x261a9d5bb7bd15543833bd441566bcca94b71fa661bb550e6b0a250d542e497c
hash[8]: 0x1562fa90059824704d859ed4186ee13a656c5854335fa00859a5ce468e2bce66
hash[9]: 0x2e08fcdf168c91cbb7a10c62055a0e011135c29f45cb924243393e7667985451
hash[10]: 0x707eb57844dd046a52d77461036dfb482412af43da85ad75c174cd587d2c1e6
hash[11]: 0x1800d2c82d9c6b03a66c3c6dbe267b1de0e1ea4c34d298459df927d39c0ca894
hash[12]: 0x240e5112593dbb9542d0526b958ce6b5142092887d21e8939f95cb8fdfa2d2b7
hash[13]: 0x14b53f6b09fd23519908136250b9a2d3425b7d2041b64bb2dbe4f01ca93470ce
hash[14]: 0x30307087a09f295313c97a98eaf62136ad3ef29353b790a4b651f68cb179a111
hash[15]: 0x931beee96e926d7f9f896de3c6e41407c91c2f53feb798fa61986411056abb1
hash[16]: 0xd402d1cb8e7e1037b2104a1fd93cf8c6506727ac3aff7d7821fe36fb56a6897
hash[17]: 0x1ff79ff64a6c183df7a3818a8d7315ba48f13eb361d8068a55a1ed68e85b625a
hash[18]: 0xeeab683f8afc66e410c66bbef6f4a0072e40464361b8f47c7227e72e8022ac1
hash[19] (root): 0x6ea7e01611a784ff676387ee0a6f58933eb184d8a2ff765608488e7e8da76d3
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
    tokenS: number,
    tokenB: number,
    amountS: string,
    amountB: string,

    allOrNone: number,
    validSince: number,
    validUntil: number,
    maxFeeBips: number,
    buy: number,

    feeBips: number,
    rebateBips: number,

    signature: Signature,

    # The data in the trade history of tokenS before they are updated
    tradeHistoryFilled: string,
    tradeHistoryCancelled: number,
    tradeHistoryOrderID: number,
}

class Ring
{
    orderA: Order,
    orderB: Order,

    ringMatcherAccountID: number,
    feeRecipientAccountID: number,
    tokenID: number,
    fee: string,
    nonce: number,

    ringMatcherSignature: Signature,
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
    accountUpdate_A: AccountUpdate,

    # OrderB:
    # Balance update data for tokenS, tokenB and tokenF
    # Account update data
    balanceUpdateS_B: BalanceUpdate,
    balanceUpdateB_B: BalanceUpdate,
    accountUpdate_B: AccountUpdate,

    # Ring-matcher:
    # Balance update data for tokenB of orderA and orderB (fee/rebate/protocol fee)
    # and token used for paying the operator
    # Account update data
    balanceUpdateA_M: BalanceUpdate,
    balanceUpdateB_M: BalanceUpdate,
    balanceUpdateO_M: BalanceUpdate,
    accountUpdate_M: AccountUpdate,

    # Balance update data for protocol fee payments
    balanceUpdateA_P: BalanceUpdate,
    balanceUpdateB_P: BalanceUpdate,

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

    # Protocol fees used in this block
    protocolTakerFeeBips: number;
    protocolMakerFeeBips: number;

    # Protocol fee account update data (account 0)
    accountUpdate_P: AccountUpdate,

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
    dualAuthPublicKeyX: string,
    dualAuthPublicKeyY: string,
    dualAuthSecretKey: string,
    tokenIdS: number,
    tokenIdB: number,
    amountS: string,
    amountB: string,
    allOrNone: boolean,
    validSince: number,
    validUntil: number,
    buy: number,
    maxFeeBips: number,
    feeBips: number,
    rebateBips: number,
}

Ring
{
    ringMatcherAccountID: number,
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
