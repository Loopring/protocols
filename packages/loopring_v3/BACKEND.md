**Important**! There are some very minor differences between the implementation and the docs (merkle tree depths, operatorAccountID placement in onchain calldata). The implementation will be updated to reflect the docs as soon as possible.

## Merkle tree format

![Merkle Tree](https://i.imgur.com/RcoayPR.png)

All Merkle trees are currently stored in a sparse Merkle tree format. The Merkle trees are _Quadtrees_, not binary trees. The Accounts Merkle tree (the top part) does **NOT** need to be stored like that. For the circuits it does not matter if the Merkle tree is sparse or not. The only thing important for the circuits is that the depth of the leafs is always the same. Accounts are added to the tree one after the other. The same is not true for the sub-Merkle trees. Here any leaf can be used at any time so the implementation should use a sparse Merkle tree.

To verify data is stored in the Merkle tree a [Merkle proof](https://medium.com/crypto-0-nite/merkle-proofs-explained-6dd429623dc5) is used. This is key to how the circuits work.

The Merkle tree currently uses Poseidon/t5f6p52 for all hashes (leafs and non-leafs).

Helpful links:

- A test implementation of a [sparse Merkle tree in Python](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/operator/sparse_merkle_tree.py)
- [EdDSA implementation in JS](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/test/eddsa.ts)
- [Poseidon implementation in JS](https://github.com/Loopring/protocols/blob/master/packages/loopring_v3/test/poseidon.js)

### Leaf nodes

Note that Poseidon works directly on field elements, data is not packed together as small as possible in a single bitstream.

- Account leaf: `Poseidon([publicKeyX, publicKeyY, nonce, balancesRoot])`
- Balance leaf: `Poseidon([balance, tradeHistoryRoot])`
- TradeHistory leaf: `Poseidon([filled, cancelled, orderID])`

### Non-leaf nodes

`Poseidon([child0, child1, child2, child3])`

### Default hashes

#### Trading History

```
TradeHistory leaf: 0x2874a569c01627ec42738d210efcec8a9034000d070afcf92172ce4527fdfc59
= Poseidon([0, 0, 0])

hash[0]: 0x53e62a1226ef0c89837ac7aed6bcdf075d2ddc0a2807f29f04b38c86f8c4334
hash[1]: 0x1374ba9d4060897d4575afebbcb09a98c6e05d18e6015d39d9e28b61fc2bf07e
hash[2]: 0xff0364c3584189b81443e5cfcdfae10bd2fed5f85590fc26e75fd0899ae278
hash[3]: 0x2ab4de41356569a924fea4d875b77275e738c03d975a325c4599e1f6b0deeb5f
hash[4]: 0x7dc8caebf4bd0d858012e793e18831c66c6798793b1adef6b234d12b64d4cb0
hash[5]: 0x1c384e244f70d17e2a203d2af0f07c1da99566f7b86af060a7b4ffeb034ad6be
hash[6] (root): 0xe935d219f8a67c3c78f832f261675a1fd93071c0beaf636b79641efd50ec662
```

#### Balances

```
Balance leaf: 0x1c0561635be467f71418abe366f4802fa88705e0f668ee63c1db405b47e9f803
= Poseidon([0, 0xe935d219f8a67c3c78f832f261675a1fd93071c0beaf636b79641efd50ec662])

hash[0]: 0x2e966b8e863f806704a50405393c5a35e328cad6472f6e266d17243154689240
hash[1]: 0x138187b32614ff1b023ef18d1c82d0b6abdbb2a86445b72dc10af124169da379
hash[2]: 0x244ed6c8f58b771824f2b4a267dc6c060b6b03fd8dc92a637a909a5127b28f81
hash[3] (root): 0x174b4b1ef67270683f7356df20528f2487d12e2b25696d35cf3edfb0f300461e
```

#### Accounts

```
Account leaf: 0x28f73e870fc3c0e5da130efd6df1456d8e08bbe4723c5c6789e8e8f1eaadff40
= Poseidon(["0", "0", 0, 0x174b4b1ef67270683f7356df20528f2487d12e2b25696d35cf3edfb0f300461e])

hash[0]: 0x96750bff81a03746ab11c2121e8afa8e2a40290c6e73215f6580c3caabb4d47
hash[1]: 0xcb87a8c3e5b66307fdad7d8aaa0916ab1a4eeee7b4777aa9efe5bce0784fe73
hash[2]: 0x1502ded038eeeed8a9f440f630961606a3a8c5982602fd769b7e8c1ccb1c8841
hash[3]: 0x28d56f05c9057171869d8b106ae783dd7b15b6533abea786bd79dca25a097412
hash[4]: 0x2b55448eac2168ec095eea7a2ad062316f54291662d9da234b0262a08943cc03
hash[5]: 0xb416ea9dd0c39f59316ce2bb75c4c195789ad770aa725cd46cffe724d82d2b0
hash[6]: 0x26b73d5dbc5c5237900b9e87d6dc0c1272b9c5a7ec9dfe402e27f88a8c36722f
hash[7]: 0x1cb15506126b729b36db8fc0c1649cc1494297843919074a30745e841f8701f5
hash[8]: 0x2152ef3a41ed0539e45bfeb75180ba7a2d04cc1a074c487c2e8856098201218e
hash[9] (root): 0x2b4827daf74c0ab30deb68b1c337dec40579bb3ff45ce9478288e1a2b83a3a01
```

## Block file format

The prover program expects a block as input in the JSON format.

The data is stored in the following format for the different block types.

### General data formats

```
QUAD_TREE_DEPTH_ACCOUNTS = 12
QUAD_TREE_DEPTH_BALANCES = 5
QUAD_TREE_DEPTH_TRADEHISTORY = 7

Proof(length)
{
    # Merkle inclusion proof data
    data: string[length],
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
    proof: Proof(QUAD_TREE_DEPTH_BALANCES * 3),
    rootBefore: string,
    rootAfter: string,
    before: BalanceLeaf,
    after: BalanceLeaf,
}

TradeHistoryUpdate
{
    orderID: number,
    proof: Proof(QUAD_TREE_DEPTH_TRADEHISTORY * 3),
    rootBefore: string,
    rootAfter: string,
    before: TradeHistoryLeaf,
    after: TradeHistoryLeaf,
};

AccountUpdate
{
    accountID: number,
    proof: Proof(QUAD_TREE_DEPTH_ACCOUNTS * 3),
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
}

class Ring
{
    orderA: Order,
    orderB: Order,
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
    # Balance update data for tokenS, tokenB
    # Account update data
    balanceUpdateS_A: BalanceUpdate,
    balanceUpdateB_A: BalanceUpdate,
    accountUpdate_A: AccountUpdate,

    # OrderB:
    # Balance update data for tokenS, tokenB
    # Account update data
    balanceUpdateS_B: BalanceUpdate,
    balanceUpdateB_B: BalanceUpdate,
    accountUpdate_B: AccountUpdate,

    # Balance update data for protocol fee payments
    balanceUpdateA_P: BalanceUpdate,
    balanceUpdateB_P: BalanceUpdate,

    # Balance update data for the operator (fee/rebate/protocol fee)
    balanceUpdateA_O: BalanceUpdate,
    balanceUpdateB_O: BalanceUpdate,
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

    # Operator Signature
    Signature signature;

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
    amount: string;
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
    amountRequested: string,
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
    amountRequested: string,
    fee: string,
    signature: Signature,

    # User:
    # Balance update data for tokenF and token withdrawn
    # Account update data
    balanceUpdateF_A: BalanceUpdate,
    balanceUpdateW_A: BalanceUpdate;
    accountUpdate_A: AccountUpdate;

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
- The [circuit code](https://github.com/Loopring/protocol3-circuits)
