WIP of protocol 3.0 design.

# Intro

For protocol 3 we want to greatly improve throughput of the protocol. We do this by using zk-SNARKs. As much work as possible is done offchain while we only verify the work onchain.

For the best performance we support offchain balances. These are balances that are stored in a merkle tree. Users can deposit and withdraw tokens to the smart contract and their balance is updated in the merkle tree. This way we can support transferring tokens between by just updating the merkle tree offchain, no need for expensive token transfers onchain.


We do still want to support onchain transfers:
- It may not be possible to deposit/withdraw security tokens to the smart contract
- Users may prefer to keep funds in their normal wallet

Do note that there is never any risk of losing any funds when depositing to the smart contract. Both options are non-custodial.

Data availability for all merkle trees is ensured. Anyone can recreate the same merkle trees just by using the data available on the Ethereum blockchain.

> Question (Daniel): what if the offhchain operator doesn't handle a user's onchain deposit? Given two operations, a) a user created a account and deposited some tokens onchain, b) another user submitted an order offchain. Does the operator need to choose which operation should be put into the merkle tree first? Will this affct the way the merkle tree is built thus invaliate the garantee that the same merkle trees can be built using all data onchain? Or if order submision will not be part of the merkle tree? What about order cancellation then?

> Question (Daniel): should we also user a nonce per account to make sure the operator never miss an instruction (submitOrdder or cancelOrder)? Although the operator does have the option to not `mine` an instruction.


## Trading using onchain and offchain balances

### Risks with paying using onchain balances

The proof has all the data baked in on how to settle the rings. There's nothing we can do to change the state changes that are done inside the SNARK.

When a user pays using his onchain balance, sufficient funds need to still be available when the token transfer is done onchain. Depending on how long the proof generation takes, this can be tens of seconds between calculating the filled amounts of the rings and actually doing the token transfer onchain. To make things worse, the account ID is sent onchain for everyone to see. The owner of the account can monitor the pending transaction pool and try to lower his balance and/or allowance to make the onchain transfer fail.

The design contains some mitigations for this problem.


> Question (Daniel): with offchain balance, if user can withdral funds onchain, it also means the settlement with a new merkle root and proof will fail, won't it? Unless the withdrawal must be honored offchain (like an withdrawal approval).


### The many advantages of offchain balances:

#### Immediate finality
Offchain balances are guaranteed to be available for a short time in the future (until a withdrawal). This allows a CEX like experience. A DEX can settle a ring offchain and immediately show the final results to the user without having to wait on the onchain settlement. Using onchain balances, users can modify their balances/allowances directly by interfacing with the ethereum block chain. So finality is only achieved when the ring settlement is done on the ethereum blockchain.

#### Higher throughput/Lower cost
An offchain token transfer is strictly a small extra cost for generating the proof for updating a merkle tree. The cost of a single onchain token transfer is ~20,000 gas. Checking the balance/allowance of the sender is an extra ~5,000 gas. These costs greatly limit the possible thoughput and increases the cost of settling rings. 

#### Concurrent proof generation
If we don't do onchain transfers we don't need the proof immediately when settling rings because we can easily revert the state back by restoring the merkle tree roots. The operator can just call `commitBlock` without a proof, but the operator includes a deposit instead. The operator then needs to submit the proof within some time limit (e.g. 120 seconds) or he loses his deposit (which needs to be substantial). This allows for:

1. Faster settlement of rings because operators don't need to wait on the proof generation before they can publish the settlements (and thus also the new merkle tree states) onchain.
2. The proof generation can be parallelized. Multiple operators can generate a proof at the same time. This isn't possible otherwise because the initial state needs to be known at proof generation time.

There is **NO** risk of losing funds for users. The worst that can happen is that the state is reversed to the latest state that was successfully proven. All rings that were settled afterwards are automatically reverted by restoring the merkle roots. Blocks with deposits that were reverted need to be re-submitted and withdrawals are only allowed on finalized state.

> Question (Daniel): What's the beneifit of `commitBlock` without the proof (which is to be submitted later)? I don't think users can withdrawa funds after `commitBlock` because the proof is not submitted yet so user's balances aren't real.
> 
> Thought (Daniel): if the operator's deposit is not large enough, what he can do to hack the system is to `commitBlock` so his own accounts can have a lot of balance to withdrawa, and withdraw all those funds ASAP, then get his own deposit lost, but still end up with a profit.


# Design

## Token registration

Before a token can be used in the protocol it needs to be registered so a small token ID of 2 bytes can be used instead. To limit abuse, a small amount of LRC needs to be burned. We ensure the token is not already registered.

We also add the token to the onchain TokenRegistry merkle tree. This way we can verify the burn rate of the token in the circuit.

```
// EVM:
Token {
    address,
    tokenType,
    uint tier;
    uint tierValidUntil;
}

Token[] tokens;
MerkleTree tokenRegistryTree;
registerToken(address, tokenType) {
    require(!isRegistered(address, tokenType), "ALREADY_REGISTERED");
    require(LRC.burnFrom(msg.sender, TOKEN_REGISTRATION_FEE), "INSUFFICIENT_BALANCE"));

    Token token;
    token.address = address;
    token.tokenType = tokenType;
    token.tier = TIER_4;
    token.tierValidUntil = 0xFFFFFFFF;
    tokens.append(token);

    uint address = tokenRegistryTree.add(token);
    return address;
}
```

> Question(Daniel): why the TokenRegistryTree not offchain?

> Question(Daniel): "This way we can verify the burn rate of the token in the circuit." how?


## Account creation (and Depositing)

When depositing a new account is created in the Accounts merkle tree with the deposited amount. 

This is done by calling the deposit function on the smart contract and adding the account info to an onchain hash. To ensure that it's not too expensive for the circuit to add all these accounts we limit the number of accounts that can be created in a certain timespan. We can also support paying a fee for this. A fee in ETH seems to make sense because the user needs ETH to interact with the smart contract anyway. The fee amount can be set by the DEX.

> Question (Daniel): WIll limiting the tota number of accounts lower the cost of computing each proof, or we do this because we want the tree itself to be as small as possible? I think I like applying a fee instead of throttling.

Note that we can **directly support ETH**, no need to wrap it in WETH when using offchain balances.

We don't require the msg.sender to be the owner. This allows a DEX or an operator to create accounts for a user, but the owner does need to provide a signature for safety.

```
// EVM:

Account {
    dexID,
    owner,
    brokerPublicKey,
    token,
    isOffchain,
    validFrom,
    validUntil,
}

uint numAcounts = 0;
deposit(dexID, owner, brokerPublicKey, token, balance, isOffchain, signature) {
    require(msg.sender == owner || verifySignature(owner, ...,  signature), "UNAUTHORIZED");
    require(depositBlock[blockIdx/10].count < maxNumDepositsInBlock, "BLOCK_FULL");
    require(token.transfer(msg.sender, this, amount), "INSUFFICIENT_BALANCE");
    require(msg.value >= Dex.depositFee, "INSUFFICIENT_FEE_AMOUNT");
    this.send(msg.value);
    // Save the start index when starting a new block
    if (depositBlock[blockIdx/10].count == 0) {
        depositBlock[blockIdx/10].hash = numAcounts;    
    }
    depositBlock[blockIdx/10].hash = sha256(depositBlock[blockIdx / 10].hash, [publicKey, token, balance, nonce]);
    depositBlock[blockIdx/10].feeAmount += msg.value;
    depositBlock[blockIdx/10].count++;

    accounts[numAccounts].dexID = dexID;
    accounts[numAccounts].owner = owner;
    accounts[numAccounts].brokerPublicKey = brokerPublicKey;
    accounts[numAccounts].token = token;
    accounts[numAccounts].isOffchain = isOffchain;
    accounts[numAccounts].validFrom = 0;
    accounts[numAccounts].validUntil = 0xFFFFFFFF;

    return numAccounts++;
}
```
> Question (Daniel): inside the code above, why `depositBlock[blockIdx/10].hash = numAcounts;`, why not the previous depositBlock's hash or `depositBlock[blockIdx/10].hash = depositBlock[blockIdx/10 -1].hash;`?


We also need to store the deposit information onchain so users can withdraw these balances in withdrawal mode when they are not yet added in the Accounts merkle tree.

Some blocks afterwards we could force the operator to include the new accounts if necessary in a proof.

```
// EVM:
// Operator gets the fee
msg.sender.send(depositBlock[X].feeAmount);

// SNARK:
Account leaf: AccountID -> [dexID, owner, brokerPublicKey, token, balance, isOffchain, fence]

deposit(depositBlock[X].hash, numAccounts, accounts) {
    // For all accounts:
    // 1. Ensure the leaf is empty
    // 2. Add the account to the leaf at numAccounts
    // 3. numAccounts++
    // Ensure depositHash == addedAccounts
}
```

> Question (Daniel): I don't understand how new accounts are added to the merkle tree offchain, nor how the deposit works. Need to walk me through.

## Withdrawing

The user lets the operator know somehow (see below) that he wants to withdraw. The witdrawal process:

```
// EVM:
dex.blocks[dex.blockIdx].withdrawals.append(Withdrawal(withdraw.account, withdraw.amount));

// SNARK:
withdraw() {
    // 1. Check signature of the withdraw message
    // 2. Verify account.publicKey == withdraw.publicKey
    // 3. Verify account.amount >= withdraw.amount
    // 4. Subtract the witdrawal amount of the account balance and calculate the new merkle root
}
```

The balance can be withdrawn by anyone from the contract after the block has been finalized:

```
withdraw(dexID, blockIdx, withdrawalIdx) {
    Dex dex = dexs[dexID];
    Block block = dex.blocks[blockIdx];
    require(block.finalized);
    Withdrawal withdrawal = block.withdrawals[withdrawalIdx];
    Account account = accounts[withdrawal.accountID];
    require(account.token.transfer(account.owner, withdrawal.amount));
}
```

A maximum withdrawal fee for a DEX is specified when the DEX is created. The DEX is allowed to change the withdrawal fee in the [0, MAX_WITHDRAWAL_FEE] range. This is to make sure the DEX cannot change the fee to something unreasonable. This maximum fee can be specified in USD to protect against ETH price fluctuations. By using a USD/ETH price source onchain anyone can update the ETH equivalent that needs to be paid.

#### Withdrawing funds by sending a request to the operator

The user sends a request for withdrawal an order. The operator should include the withdrawal in a reasonable time in a block, though no guarantees can be made to the user when it will be included.

#### Withdrawing funds by requesting a withdrawal onchain

We can force the operator to include a withdrawal requests in the same way we create the accounts. We batch them up onchain in a withdrawalHash and force the inclusion in a proof after a reasonable time.


## Account closing

It's possible to close an account onchain. This is useful when a user wants to disable all trading using the account, but withdrawing the offchain balance could be too slow (because of the limited number of withdrawals that can be done, or the operator wants to do). To prevent abuse by users, closing an account will only takes effect after some time so that the orders that are already being proven by the operator cannot be made invalid. This delay should be about how long it takes to create a proof and some extra buffer.


## Ring settlement

```
Order {
    owner,
    publicKey,               // public key of signer for EDDSA 
    dualAuthorPublicKey,

    dexID,
    orderID,

    accountS,
    accountB,
    accountF,
    amountS,
    amountB,
    amountF,

    allOrNone,

    fence,

    signature,
}
```

```
Ring {
    orderA,
    orderB,

    fillS_A,
    fillB_A,
    fillF_A,

    fillS_B,
    fillB_B,
    fillF_B,

    nonce,

    signature,
}
```

```
// SNARK
settleRing(ring, dex.nonce) {
    // 1. Verify order signatures of all orders in ring 
    // 1.a If the order doesn't contain a signature check if the order was registered in the OrderRegistryMerkleTree
    // 2. Check if ring is settled correctly (fill amounts correct, tokenS/tokenB match, ...)
    // 3. Verify burnrate of tokenF using a merkle proof
    // 4. Verify + Update accounts balances (offchain balances only)
    //     - Verify the merkle proofs of the balances before
    //     - Verify the order owner is the owner of accountS and accountF
    //     - Calculate the new merkle root using the update balances
    // 5. Update trade history
    //     - Verify the merkle proofs of the filled amounts before
    //     - Calculate the new merkle root using the update filled amounts 
    // 6. Hash ring data and verify dual-author signature if needed
    // 7. if (ring.nonce != 0) { ensure(ring.nonce == dex.nonce + 1); dex.nonce++; }
}

void settleRings(rings) {
    for (int i = 0; i < NUM_RINGS; i++) {
        settleRing(rings[i]);
    }
    // Hash all data passed onchain and compare with the value passed in as public input
}
```

There's a couple of differences when using onchain balances or offchain balances. With onchain balances we run into some problems because of the uncertainty of the balance at the time `commitBlock` is evaluated onchain.

We could simply fail the complete transaction (and all orders settled in it) and a new proof needs to be generated. This could get expensive for the operator and could be abused by order owners.

### Reverting the ring onchain

Our options are limited here. The SNARK is fixed and will update the filled amounts (or even the offchain balances) in the merkle tree as was calculated at proof generation. 

We can scale the onchain transfers using the actual balances available. The filled amounts will still be updated, with higher amounts than was actually done.

Actually scaling the order needs additional information of the order not available onchain normally (amountS, amountB, amountF), so the easiest solution is to just not do the transfers anymore.

```
for (ring of rings) {
    if (isOnChain(ring.transfer)) {
        if (getSpendable(transfer.from) < transfer.amount) {
            ring.revert();
        }
    }
}
```

The filled amounts for all orders in the ring are now wrong and the balances in the merkle tree could be wrong depending on the type of transaction. But we can mitigate this problem.

We have enough data onchain to create intructions for the operator on how the data can be reverted to the actual state. The instructions are batched onchain and need to be processed in the next block before any rings are settled. This way the state in the merkle tree is invalid for a single block and is resolved automatically in the next one before any incorrect state can be used. The state shown to the user can always be correct because the correct state can be deduced from the merkle tree + ring revert data onchain.

```
// EVM:
bytes ringReverts;
uint ringRevertsBitmask = 0;
for (ring in rings) {
    if (hasUnsificientBalances(ring)) {
        ringReverts.append(ring);
        ringRevertsBitmask |= (1 << ringIdx);
    }
}
block.ringRevertsHash = sha256(ringReverts)
emit RingSettlementReport(ringRevertsBitmask);

// SNARK:
RingRevert {
    uint accountS_A;
    uint accountB_A;
    uint accountF_A;
    uint accountS_B;
    uint accountB_B;
    uint accountF_B;
    uint orderID_A;
    uint orderID_B;

    uint fill_A;
    uint fill_B;

    uint amountS_A;
    uint amountB_A;
    uint amountF_A;

    uint amountS_B;
    uint amountB_B;
    uint amountF_B;
}

revertRing(dex, ringData) {
    RingRevert ringRevert;
    ringRevert.accountS_A = ringData.transactions[0][0].from;
    ringRevert.accountB_A = ringData.transactions[1][0].to;
    ringRevert.accountF_A = ringData.transactions[0][1].from;
    ringRevert.accountS_B = ringData.transactions[1][0].from;
    ringRevert.accountB_B = ringData.transactions[0][1].to;
    ringRevert.accountF_B = ringData.transactions[1][1].from;
    ringRevert.orderID_A = ringsData.orderIDs[0];
    ringRevert.orderID_B = ringsData.orderIDs[1];
    // We always need to revert the fill amounts
    ringRevert.fill_A = ringData.transaction[0][0].amount;
    ringRevert.fill_B = ringData.transaction[1][0].amount;
    
    for (transaction of ringData.transactions) {
        switch(getTransactionType(transaction)) {
            case TransactionType.OnchainToOnchain:
                // No offchain balances need to be updated
                break;
            case TransactionType.OnchainToOffchain:
                ringRevert.amount_$to = -transaction.amount;
                break;
            case TransactionType.OffchainToOnchain:
                ringRevert.amount_$from = +transaction.amount;
                break;
            case TransactionType.OffchainToOffchain:
                ringRevert.amount_$to = -transaction.amount;
                ringRevert.amount_$from = +transaction.amount;
                break;
        } 
    }	
    // Revert filled amounts/balances using data in ringRevert
}
// Hash all ringData together and check with ringRevertsHash from public input
```

The operator that needs to generate the next block needs to create a proof containing these reverts so the number of reverts possible needs to be limited somehow. Either by limiting the number rings that are settled using onchain balances, or just by failing the transaction if the number of reverts necessary is higher than some fixed number. The second option seems to make the most sense because these reverts should be rare.

### User bonds for onchain transfers

If a ring using onchain transaction fails because the order owner doesn't have enough funds available the operator can still be paid a small fee for the work (and the loss in fees) using these funds. This also prevents abuse by users.
- This would be optional. The operator does not need to be paid a fee if he's OK with the added risk.
- Because the user could accidentially not have enough funds for an order, we also have to protect the order owner. The funds would only be able to be used once every hour for example. The amount of funds a user would be able to lose should be very small. A DEX/wallet could even monitor this for his users and inform them via a warning in the GUI or via email.

We have a couple of options on how we could achieve this:

- We can allow the order owner to deposit some funds to a contract. These funds would not be immediately withdrawable just like the offchain balances, so we have a guarantee they are available some time in the future. The maximum amount the user would be able to deposit would be 10x the small fee that would be paid to the operator for a single failed ring.
- We could also force all fee payments to be offchain -> offchain. This way we don't even need special bond balances. The small fee could be paid directly from the fee that would be paid for the ring settlement. Again, some time limations/maximum amount would be needed so this cannot be abused by operators.

### Token transfer types

#### onchain -> onchain

- Supports scaling rings onchain: **YES**
- Default onchain token transfer like Protocol 2

#### onchain -> offchain

- Supports scaling rings onchain: **YES**
- The receiver could have a larger balance than he actually has if the onchain transfer fails.
- The circuit cannot allow these funds to be used in all orders following this one AND we force the restore of the balance at the beginning of the next block.
- merkle tree update + onchain transaction

#### offchain -> offchain

- No onchain scaling needed.
- Only merkle tree updates needed.

#### offchain -> onchain

- No onchain scaling needed.
- merkle tree update + onchain transaction.

#### Possibilities

Note that an order needs to pay in tokenS AND tokenF. So even though e.g. for tokenF offchain -> offchain is used, for tokenS it could be onchain -> onchain, so it still needs to be reversible in that case (and so this balance cannot be used in any of the following rings).

Still, we've got some interesting possibilities here:
- A user could pay the fees using offchain transactions, while still using an onchain transaction for tokenS. This way he can still keep all his tokens on his normal wallet and just deposit some LRC in the contract for cheaper fees.
- tokenS could be paid using offchain balances, but the user could get the tokens he bought directly in his normal wallet.

## Cancelling orders

The importance of cancelling orders is reduced by supporting validSince/validUntil for orders. Orders can be short-lived and the order owner can keep recreating orders as long as they need to be kept alive. 

### Cancelling orders by sending a request to the operator

```
CancelMessage {
    owner,
    broker,
    publicKey,

    dexID,

    accountF,
    amountF,

    // Info of order to cancel
    accountS,
    orderID,

    newFence,

    signature
}
```

The user sends a request for cancelling an order. The operator should include the cancellation as soon as possible in a block, though no guarantees can be made to the user when it will be included.

The cancellation is done by setting the filled amount to the maximum value. 

```
cancelOrder(cancelMessage) {
    // 1. Check signature of the cancel message
    // 2. Verify accountS.publicKey == cancelMessage.publicKey
    // 3. Verify accountF.publicKey == cancelMessage.publicKey
    // 4. Set the filled amount to the max value for the order and calculate the new merkle root
    // 5. Set account.fence = cancelMessage.newFence
    // 6. Pay the operator the fee cancelMessage.amountF in cancelMessage.tokenF
}
```

This is the cheapest way to cancel orders. A small fee may still need to be included so the operator wants to do these.

The cancel can also increase the fence value for the account. This forces the operator to include the cancel if he wants to use orders created after the cancel was created.

### Cancelling orders by closing the account onchain

Closing an account will render all orders using the account unusable.


## Withdrawal mode

The operator may stop submitting new blocks at any time. When some conditions are met (e.g. last block was committed 1 day ago), all functionality for the DEX is halted and only withdrawing funds is possible. Any user is able to withdraw his funds from the contract by submitting an inclusion proof in the Accounts merkle tree.


## Signature types

Ideally we want to only support a single signature type. Even though only a single signature type is actually used for an order, the number of constraints the prover needs to solve is the sum of all of them.

Currently this is EDDSA (7,000 constraints), which is a bit cheaper than ECDSA signatures (estimated to be ~12,000 constraints). ECDSA signatures would be nicer because we could sign orders using existing solutions.

## ValidSince / ValidUntil

A proof is always made for a fixed input. The prover cannot accurately know what timestamp/blockIdx the proof will be verified, so we cannot just pass in the current timestamp/blockIdx as input for the proof. 

We can however easily know the approximate time the proof will be verified. Next to the proof the operator also includes the timestamp the proof was generated for. The time needed to generate the proof will be well-known so a quite accurate prediction can be made when the proof will be verified onchain. This timestamp is checked against the timestamp onchain and if it's close enough the proof is verified:

```
uint maxBehind = 60 seconds
uint maxAhead = 30 seconds
check(input.timestamp > (now - maxBehind) && input.timestamp < (now + maxAhead), "INVALID_TIMESTAMP");

verifyProof(input.timestamp, ...);
```

## Fee Payments

We need to do a lot of fee payments:
- [fee token] To the wallet
- [fee token] To the operator
- [fee token] Burn rate
- ([tokenS] Margin)

So up to 4 token transfers need to be done for every order. Remember that the proof for a circuit needs to solve the constraints for all code in the circuit. So having the possibility of 2 tokens that can pay fees (like in protocol 2 P2P orders) should really be avoided. Using tokenS OR tokenB OR tokenF is fine.

To limit the number of onchain token transfers (or having to have a special FeeHolder contract like in protocol 2 for efficiency) we can force all fee payments to be done to offchain balances. This allows the fee payment (to the wallet, operator and burnrate) to be done using a single onchain transaction if `from` is an onchain balance. We could even force all fee payments to be done from offchain balances so we never need to do an onchain transfers for fee payments.

## Burn Rate

The burn rate of tokens is stored in the onchain TokenRegistry merkle tree. Updating the burn rate of a token can be done directly onchain.


```
// EVM:
Token[] tokens;
MerkleTree tokenRegistryTree;
upgradeTokenTier(tokenID) {
    require(LRC.burnFrom(msg.sender, TOKEN_TIER_FEE), "INSUFFICIENT_BALANCE"));

    tokens[tokenID].tier++;
    tokens[tokenID].tierValidUntil = now + 1year;

    tokenRegistryTree.update(tokenID, tokens[tokenID]);
}
```

Every DEX has its own Accounts tree, so every dex is responsible for creating a burn account for every token it accepts fees in. A burn address is just a normal account with the owner set to 0x0 (and should always be an offchain account). The first 2^16 leafs of the Accounts tree are reserved for these burn accounts. This way we can ensure `tokenID == burnAccountID` and there is no ambiguity where the burn tokens are sent.

Only authorized contracts (e.g. BurnManager) are allowed to withdraw funds with `owner == 0x0`.


## Brokers

Allows a broker to sign orders for someone else.

The account system is used for this. Users can create a special account for a broker and deposit funds the broker is able to use. This is done by setting `account.brokerPublicKey` to the public key of the broker instead of the order owner. To stop the broker from being able to fill orders the balance can be withdrawn or the account can be closed.

## Onchain order registration

Allows contracts to approve orders. 

We use an onchain merkle tree for this. The order hash is added to the merkle tree. A merkle proof can be provided in the proof to authenticate the order.

```
// EVM:
MerkleTree orderRegistryTree;
registerOrder(order) {
    require(order.owner == msg.sender);
    uint address = orderRegistryTree.append(order.hash);
    return address;
}
```

## All or None orders

Easy to support in the circuit when the order is settled in a single ring. Could be pretty expensive in the circuit if we do the protocol 2 approach of completely filled after all rings.

## Miner fee waiving

Fees should be small because of the increased efficiency of the protocol. And market makers should be using offchain balances to further decrease the cost of settling rings.

Further fee waiving mechanisms TBD.

## P2P Orders

Currently no special P2P orders defined. The fee is always paid using the fee token.

# DEX states

Proof submission needs to be done sequentially so merkle trees can be updated correctly. To allow concurrent settling of orders by different DEXs (and to potentially limit the amount of data we need to send onchain) we allow DEXs to store separate states for the merkle trees that can give contention.

Another big advantage of having separate balances per DEX is that the balance cannot change without the DEX knowing (an order of the same order owner could be filled onchain in another DEX). This allows for immediate finality of the trading without having to worry about delays of getting everything settled onchain and the state not being valid anymore.

An order can only be settled in a single DEX state.

Anyone can register a DEX. A small amount of LRC can be burned so the function isn't spammed and the dex ID can fit in 2 bytes.

The owner of the DEX can close the DEX at any time. The DEX will immediately enter withdrawal mode.

```
struct DEX {
    address owner;
    address feeRecipient;

    address[] operators;

    bytes32 accountsMerkleRoot;
    bytes32 tradeHistoryMerkleRoot;
    bytes32 orderRegistryMerkleRoot;

    const uit maxProofSubmissionDelay;     // The maximum time an operator has to submit a proof
    
    const uint maxWithdrawalFee;

    uint depositFee;
    uint withdrawalFee;
    uint orderRegistrationFee;

    (optional) uint8 walletSplitPerctage;  // Fixed percentage of fee for all orders shared with the operator

    uint currentNonce;

    bool open;
}
Dex[] dexs;

registerDEX(feeRecipient, maxWithdrawalFee) {
    Dex dex;
    dex.owner = msg.sender;
    dex.feeRecipient = feeRecipient;

    dex.accountsMerkleRoot = EMPTY_ACCOUNTS_TREE;
    dex.tradeHistoryMerkleRoot = EMPTY_TRADEHISTORY_TREE;
    dex.orderRegistryMerkleRoot = EMPTY_ORDERREGISTRY_TREE;

    dex.maxWithdrawalFee = maxWithdrawalFee;

    dex.currentNonce = 1;

    dex.open = true;
    
    dexs.append(dex);

    return uint16(dexs.length - 1)
}

addOperator(dexID, operator) {
    Dex dex = dexs[dexID];
    require(dex.owner == msg.sender, "UNAUTHORIZED");
    dex.operators.append(operator);
}

removeOperator(dexID, operator) {
    Dex dex = dexs[dexID];
    require(dex.owner == msg.sender, "UNAUTHORIZED");
    dex.operators.remove(operator);
}

closeDEX(dexID) {
    Dex dex = dexs[dexID];
    require(dex.owner == msg.sender, "UNAUTHORIZED");
    dex.open = false;
    // DEX is now in withdrawal mode
}
```

## Open order book DEX

A simple wallet or other app just wants to create some orders and earn some fees without having to worry about ring matching or operators. 

Let's reserve DEX ID 0 as the open order book DEX:
- Anyone can become an operator for the DEX. The chance of being the operator for some time is proportional to the LRC staked by the operator.
- The operator can submit any rings he wants

# Operators

Operators are responsible for creating blocks. Blocks need need to be submitted onchain and the correctness of the work in a block needs to be proven. This is done by creating a proof for a SNARK. They can also be responsible for collecting orders/rings.

## Adding restrictions

The operator needs all the order data to generate the proof. To allow orders to be matched by any criteria by a DEX we need an extra mechanism so operators cannot freely match orders and/or rings if needed.

### Restrict order matching

We can use **dual-authoring** here. Orders can only be matched in rings signed by the DEX (or anyone having the necessary keys) if the order contains a dual author address.

### Restrict sequence of ring settlements

We need a way to limit how an operator can insert rings in a proof otherwise an operator can settle rings in any order messing up the real sequence the settlements happened in the DEX. We also need to ensure that the ring can only be used a single time by the operator.

We can use a **nonce** here. The ring signed by the DEX contains a nonce. The nonce in the next ring that is settled needs to be the nonce of the previous ring that was settled incremented by 1. A value of 0 for the nonce means no ordering for the ring is necessary.

## Setup

### Single operator

The easiest setup. A single operator (probably operated by the DEX itself) creates the proofs and submits everything onchain.

### Multiple operators

Multiple operators can be useful to spread the workload of generating proofs.

They can also be used as safety. If anyone is able to become an operator, it's always possible to process instructions (like cancels, withdrawals, ...) that other operators don't want to process for any reason. The chance of becoming an operator for X blocks could for example be proportional to the amount of LRC staked. 

## Fee

The operator gets a part of the fees in the orders for settling rings. We've got a couple of options how to do this, we just have to make sure that all information needed to calculate how many fees each party got is available onchain to ensure data availability.

- If there are multiple operators available the DEX can auction off the work to an operator. The operator that commits to generate the proof for the highest `walletSplitPercentage` wins the bid. This auction should end as fast as possible however so there is only a small extra delay.
- Send a single `input.walletSplitPercentage` onchain by the operator. The proof checks that `input.walletSplitPercentage >= order.walletSplitPercentage`
- Store the `walletSplitPercentage` in the Dex struct onchain if all orders would use the same split value anyway.

# Ciruit permutations

A circuit always does the same. There's no way to do dynamic loops. Let's take the rings settlement circuit as an example:
- The circuit always settles a fixed number of rings
- The rings always contain the predetermined number of orders

Let's say we want to support rings with 2 and 3 orders. We can either
- make a circuit that contains X number of rings with 2 orders and Y number of rings with 3 orders. There's a low chance the operator has the exact number of each so we have to make some rings in the circuit do nothing (e.g. set the fill amounts to 0). The prover still has the cost of verifying all rings, even if they do nothing useful.
- make all rings 3 order rings and make a circuit that can also settle 2 order rings in these 3 order rings. Here we always have the extra cost of processing the 3rd order even when it's only a 2 order ring.

We also need to do wide range of functionality. We need to have a circuit for
- depositing
- withdrawing
- settling rings
- cancelling orders

Verifying a proof onchain costs ~600,000 gas, so it may make sense to combine some functionality in a single circuit. 
It may make sense to reuse the ring settlement slots e.g. for cancellation. This is less efficient than having dedicated slots in the circuit to cancel orders (cancelling an order only needs to update the filled amount of a single order, reusing the ring settlement of 2 orders would create a lot more constraints for unused functionality like updating balances and updating the filled amount of 2 orders), but we don't have to have a fixed number of each so it's more flexible.

It also makes sense to create multiple ring settlement circuits for different number of rings settlements e.g. a circuit that can settle 128 rings and a circuit than can settle 512 rings. This way the operator doesn't need to needlessly spend money solving a large circuit when only a small number or rings needs to be settled.

# Delayed proof submission

Creating a proof can take a long time. If the proof needs to be available at the same time the state is updated onchain we limit the maximum throughput of the system by the proof generation time. If we are able to revert the onchain state easily (i.e. we don't do onchain transactions), we don't need the proof immediately. This allows different operators to work together much more efficiently:
- The selected operator that is allowed to commit work can change quickly. If the operator wants to do work than he can quickly commit that work onchain without needing the time to also generate the proof immediately.
- Different operators can be busy generating proofs for different work

We can use a simple commit and proof scheme. The operator commits all necessary data onchain and updates the state. The other operators now have all the data they need to start working on their own block. The operator also needs to send a substantial deposit which he loses when he fails to submit the proof. The state is then reverted to the last finalized block (the last block in the chain of the blocks that were all proven).

Proofs do not need to be submitted in order. The proof can be submitted anytime from the start the work was committed until the maximum proof generation time has passed.

The contract will only allow onchain transfers when the block is immediately finalized in the transaction (so all previous blocks are finalized and the current block is immediately proven). Onchain transfers cannot be reverted.

```

Withdrawal {
    uint32 accountID,
    uint96 amount,
}

Block {
    // DEX merkle trees...

    proofNeededBefore;
    dataHash,

    bool verified,
    bool finalized,

    Withdrawal[] withdrawals;
    bytes32 ringRevertsHash;
}

Dex {
    Block[] blocks,
    // ...
}

commitBlock(dexID, data) {
    require(isCurrentOperator(msg.sender), "UNAUTHORIZED");
    Dex dex = dexs[dexID];
    Block block;
    block.state = data.newState;
    block.dataHash = sha256(data);
    block.proofNeededBefore = now + MAX_PROOFGENERATION_TIME;
    dex.blocks.append(block);
}

proofBlock(dexID, blockIdx, proof, dataHash) {
    Dex dex = dexs[dexID];
    require(dex.blockIdx <= blockIdx, "INVALID_INPUT");
    Block block = dex.blocks[blockIdx];
    block.state = data.newState;
    require(block.dataHash == dataHash, "INVALID_DATA");
    require(!block.verified, "INVALID_DATA");
    bool valid = verifyProof(proof, dataHash);
    if (valid) {
       block.verified = true;
       if (dex.blocks[blockIdx - 1].finalized) {
           block.finalized = true;
           for (uint i = blockIdx + 1; i < dex.blocks.length; i++) {
               if (block[i].verified) {
                   block[i].finalized;
               } else {
                   break;
               }
           }
       }
       // Return deposit to operator
    } else {
        revertState();
    }
}

commitAndProofBlock(dexID, data, proof) {
    commitBlock(dexID, data);
    Block block = dexs[dexID].blocks.last();
    proofBlock(dexID, block.idx, proof, block.dataHash);
}

notifyProofTooLate(dexID, blockIdx) {
    Block block = dexs[dexID].blocks[blockIdx];
    require(!block.verified);
    require(now > block.proofNeededBefore);
    revertState();
}

revertState() {
    // Burn deposit of operator for LRC
    // Revert to the block before this one and delete all blocks after it
}
```

# Order sharing between DEXs

Order sharing between DEXs is possible when they have the same operator (which could be a short period of time). This is because the operator is able to modify the state of both DEXs. 

A possible use case would for example be a DEX that operates its own operator. This operator would also stake some LRC so it would also be an operator of the open order book DEX. If the operator is chosen as the operator of the open order book DEX the DEX has access to increased liquidity for some time to settle some of his orders.

DEXs would be able to choose if they'd allow this or not. 

# Implementation details

## Merkle trees

The onchain merkle trees can change at any time, which is a problem for proof generation because the merkle root needs to be known at the start of the proof generation.  To solve this problem we work with a delay. We cache the merkle tree roots as they are in `commitBlock`. These merkle roots are the ones that will be used as input for the proof X num blocks later (e.g. 10 blocks later). This way the merkle roots are completely predictable.

### Accounts

We should get away with using 3 bytes for the accounts ID (2^24 = 16,777,216 accounts possible). The accounts tree has a **depth of 24**.

### Trade History

Normally the depth is set to the number of bits of the hash function, which would be 256. However, merkle proofs (a proof a leaf is part of the merkle tree) would get expensive when using such a tree. We can use a SNARK friendly hash function for the tree, but for every depth level we would still need about 250 - 2,000 constraints to verify the merkle proof inside the SNARK (or as low as 70 with upcoming hash functions). We should be able to get away by setting the depth of the tree somewhere between 64 - 128, but we have to make sure that by using only a part of the original hash that hash collisions are still hard to calculate. A hash collision here would not be that bad however, it just means that someone with an order using the same leaf in the tree would share the filled amount value, so an order could be filled less than expected.

However, a better solution we be to use the account ID (the one used for paying amountS) as the starting bits for the address. This way collisions between orders are only possible between orders of the same user. The user can just use a simple counter that increments every time he creates an order for the account. We call this value the **order ID**. 2 bytes (up to 65,536 different orders possible for a single account, and the user needs a different account for every tokenS) should be more than sufficient in most cases. And even if it's not sufficient, a new account can be created at any time. The order ID is part of the order struct and is signed by the user.

So the address of an order in the tree is account ID (3 bytes) + order ID (2 bytes). The trading history tree has a **depth of 40**.


### Token Registry

We can set the maximum number of tokens that can be registered to 4096. The onchain token registry tree has a **depth of 12**.

### Order Registry

Using the order registry to register orders will be quite rare. We can limit the maximum number of orders that can be registered to 1,048,576. The onchain order registry tree has a **depth of 20**.


## Onchain data

**Data availability is ensured for ALL merkle trees for ALL DEXs**. `commitBlock` takes the following data, packed together in single `bytes` parameter:

- The DEX ID(s)
- The new TradingHistory merkle tree root
- The new Accounts merkle tree root
- The new nonce for the DEX
- Timestamp used in the proof
- Order data stored as
    - Transfer types (1 byte) (Onchain/offchain permutations (2 bits) x 4)
    - DEX ID (2 bytes)
    - order ID (2 bytes)
    - [sell] From (3 bytes)
    - [sell] To (buyer) (3 bytes)
    - [sell] To (margin) (3 bytes)
    - [sell] Amount (12 bytes)
    - [sell] MarginPercentage (1 byte)
    - [fee] From (3 bytes)
    - [fee] To (wallet) (3 bytes)
    - [fee] To (operator) (3 bytes)
    - [fee] Amount (12 bytes)
    - [fee] WalletSplitPercentage (1 byte)
    - => **49 bytes/order**

We can save some more bytes (e.g. on the amount for the fee payment, we don't really need 12 bytes) so we can probably get this down to ~40 bytes/order.

Always paying a fee using tokenS would reduce this even further (and would also make the circuit less expensive) but would of course limit the usability of LRC and may not not be possible with security tokens.

For the public input of the SNARK we also use the following onchain data:
- The current TradingHistory merkle tree root
- The current Accounts merkle tree root
- The TokenRegistry merkle tree root of X blocks ago
- The OrderRegistry merkle tree root of X blocks age
- The current nonce of the DEX

We hash all this data onchain using `sha256` and pass the hash value as the only public input to the SNARK.

## Performance

### Onchain data

Maximum gas consumption in an Ethereum block: 8,000,000 gas

- ~48 bytes for a single order
- => Maximum calldata cost/order = 48*68 = **3,264 gas** (will be a bit lower because there will be zero bytes which are much cheaper in calldata (68 gas vs 4 gas))

**No onchain transfers:**
- Verifying a proof + some state updates/querying: 600,000 gas
- => (8,000,000 - 600,000) / 3,264 = 2,267 orders/block = 151 orders/second

**Onchain transfers for tokenS -> tokenB (offchain transfers for fee payments):**
- Verifying a proof + some state updates/querying: 600,000 gas
- checking available tokenS funds (balance/allowance check): ~5,000 gas
- 1 onchain transfer/order: ~20,000 gas
- => (8,000,000 - 600,000) / (25,000 + 3,264) = 283 orders/block = 19 orders/second

**Onchain transfers for tokenS -> tokenB AND tokenF -> feeRecipients (offchain balances):**
- Verifying a proof + some state updates/querying: 600,000 gas
- checking available tokenS/tokenF funds (balance/allowance check): ~10,000 gas
- 2 onchain transfers/order: ~40,000 gas
- => (8,000,000 - 600,000) / (50,000 + 3,264) = 150 orders/block = 10 orders/second

### Proof generation

TBD

# Case studies

## DEX with CEX-like experience

### Setting up the DEX

The DEX
- calls **registerDEX** to create state for the DEX and get the DEX ID
- makes sure that all tokens it wants to trade are registered. If not, the DEX registers the missing tokens using **registerToken**
- registers all operators that are allowed to generate proofs for the DEX.

### Trading

The user
- deposits TokenA using `deposit` on the smart contract
- creates an order for exchanging TokenA/LRC using TokenA as fee
    - The DEX needs to make sure the user has leaves for all tokens used in an order in the Accounts tree
    - The user doesn't yet have a leaf for LRC so the DEX creates one for the user by calling `deposit`. The DEX could charge the user for this small cost.

The order can now be added to the order books of the DEX. 

The DEX matches the order and it gets completely filled in the ring:
- The GUI of the DEX can be updated immediately with the state after the ring settlement. The order can be shown as filled, but not yet verified.
- The DEX signs the ring containing a nonce to ensure the correct sequence of ring settlements and sends it to an operator. If there are multiple possible operators than the operator can be chosen in multiple ways (bidding with lowest fee, chance using stake amounts, ..). The DEX can operate its own operator(s). Because these rings need to be settled in a reasonable time the operator needs to call `commitBlock` as soon as possible after receiving rings. Every DEX has a list of trusted operators which he can update as needed.
- The operator chooses to call `commitBlock` without a proof to allow the parallelization of the proof generation.
- The operator generates the proof and calls `proofBlock` within the maximum time allowed

The DEX could now show an extra 'Verified" symbol for the order fill. 

An order can be in the following states:
- In an orderbook
- Matched by the DEX
- Included in a block sent in `commitBlock`
- Verified in a block by a proof in `proofBlock`
- Finalized when the block it was in is finalized (so all blocks before it were also verified)

Only when the block is finalized is the filling of the order irreversible.
