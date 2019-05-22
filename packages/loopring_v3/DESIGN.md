## Table of Contents

   * [Loopring 3.0](#loopring-30)
      * [Introduction](#introduction)
      * [New Development](#new-development)
      * [Trading with Off-chain Balances](#trading-with-off-chain-balances)
         * [Apparent Immediate Finality](#apparent-immediate-finality)
         * [Higher Throughput &amp; Lower Cost](#higher-throughput--lower-cost)
   * [Design](#design)
      * [Merkle Tree](#merkle-tree)
      * [Blocks](#blocks)
         * [Circuit Permutations](#circuit-permutations)
         * [Committing and Verifying Blocks On-chain](#committing-and-verifying-blocks-on-chain)
      * [Operators](#operators)
         * [Restrictions Imposed on the Operator](#restrictions-imposed-on-the-operator)
      * [Exchanges](#exchanges)
         * [Exchange Creation](#exchange-creation)
         * [Exchange Staking](#exchange-staking)
         * [Exchange Shutdown](#exchange-shutdown)
         * [Maintenance Mode](#maintenance-mode)
         * [Token Registration](#token-registration)
         * [Token Deposit Disabling](#token-deposit-disabling)
         * [On-chain Fees](#on-chain-fees)
      * [Fee Model](#fee-model)
      * [Signatures](#signatures)
      * [Account Creation](#account-creation)
      * [Depositing](#depositing)
      * [Withdrawing](#withdrawing)
         * [Automatic Distribution of Withdrawals](#automatic-distribution-of-withdrawals)
         * [Fee Burning](#fee-burning)
         * [Off-chain Withdrawal Request](#off-chain-withdrawal-request)
         * [On-chain Withdrawal Request](#on-chain-withdrawal-request)
      * [Ring Settlement](#ring-settlement)
         * [Rings Accepted in the Circuit](#rings-accepted-in-the-circuit)
         * [Off-chain Data](#off-chain-data)
      * [Canceling Orders](#canceling-orders)
         * [Limit Validity in Time](#limit-validity-in-time)
         * [Off-chain Order Cancellaton Request](#off-chain-order-cancellaton-request)
         * [Updating the Account Info](#updating-the-account-info)
         * [The party with the dual-author keys stops signing rings containing the order](#the-party-with-the-dual-author-keys-stops-signing-rings-containing-the-order)
         * [Creating an order with a larger orderID in the same trading history slot](#creating-an-order-with-a-larger-orderid-in-the-same-trading-history-slot)
         * [The DEX removes the order in the order-book](#the-dex-removes-the-order-in-the-order-book)
      * [Trading History](#trading-history)
         * [Order Aliasing](#order-aliasing)
      * [On-chain Deposit/Withdraw Request Handling](#on-chain-depositwithdraw-request-handling)
      * [Withdrawal Mode](#withdrawal-mode)
      * [Wallets](#wallets)
      * [Ring-Matchers](#ring-matchers)
      * [Brokers](#brokers)
      * [Timestamp in Circuits](#timestamp-in-circuits)
      * [On-chain Data](#on-chain-data)
      * [Throughput (Ring Settlements)](#throughput-ring-settlements)
         * [On-chain Data-availability Limit](#on-chain-data-availability-limit)
         * [Constraints Limit](#constraints-limit)
         * [Results](#results)
         * [Future Improvements](#future-improvements)
         * [Proof Generation Cost](#proof-generation-cost)
   * [Case Studies](#case-studies)
      * [DEX with CEX-like Experience](#dex-with-cex-like-experience)
         * [Setting up the exchange](#setting-up-the-exchange)
         * [Trading](#trading)
      * [Deposit and Withdrawal Process](#deposit-and-withdrawal-process)
      * [Order Sharing with Dual-Authoring](#order-sharing-with-dual-authoring)


# Loopring 3.0

## Introduction
In Loopring Protocol 3 we want to improve the throughput of the protocol significantly. We do this by using zk-SNARKs -- as much work as possible is done off-chain, and we only verify the work on-chain.

For the highest throughput, we only support off-chain balances. These are balances that are stored in Merkle trees. Users can deposit and withdraw tokens to our smart contracts, and their balance will be updated in the Merkle trees. This way we can transfer tokens between users just by updating the Merkle tree off-chain, there is no need for expensive token transfers on-chain.

In the long run, we still want to support on-chain transfers due to reasons such as:

- It may be impossible to deposit/withdraw security tokens to the smart contract
- Users may prefer to keep funds in their regular wallets for security reasons

Note that there is never any risk of losing funds when depositing to the smart contract. Both options are trust-less and secure.

Data availability for the Merkle tree is an option that can be turned on or off when creating exchange built on Loopring. When data-availability is enabled, anyone can recreate the Merkle tree just by using the data published on-chain.

## New Development

Things change quickly.

One of the main drawbacks of SNARKs compared to STARKs is the trusted setup. This problem seems to be largely solved. ([Sonic: Nearly Trustless Setup](https://www.benthamsgaze.org/2019/02/07/introducing-sonic-a-practical-zk-snark-with-a-nearly-trustless-setup/)). It remains to be seen if the better proving times of STARKs will be important in the future or not (proving times for SNARKs may be a non-issue or could be improved as well). Currently, STARKs also have a much larger minimal cost for verifying a proof on-chain (starts at 2,500,000-4,000,000 gas compared to just 500,000 gas for SNARKs, leaving a much smaller part for on-chain data-availability).

Bellman is also being used more and more instead of libsnark for creating the circuits. They work mostly the same (manually programming the constraints). We should use the library/framework with the best support and ease of use, while still allowing efficient circuits to be generated. The current implementation uses libsnark with the help of [ethsnarks](https://github.com/HarryR/ethsnarks).

## Trading with Off-chain Balances

### Apparent Immediate Finality
Off-chain balances are guaranteed to be available for a short time in the future (until a withdrawal), which allows for a CEX like experience. A DEX can settle a ring off-chain and immediately show the final results to the user without having to wait for the on-chain settlement confirmation. Using on-chain balances, users can modify their balances/allowances directly by interfacing with the blockchain, therefore finality is only achieved when the ring settlement is confirmed on-chain.

### Higher Throughput & Lower Cost
An off-chain token transfer takes only a minimal cost for generating the proof for updating a Merkle tree. The cost of a single on-chain token transfer, however, takes roughly 20,000 gas, and checking the balance/allowance of the sender takes roughly another 5,000 gas. These costs significantly limit the possible throughput and increase the cost of rings settlement.

# Design

## Merkle Tree

A Merkle tree is used to store all the permanent data needed in the circuits.

![Merkle Tree](https://i.imgur.com/RcoayPR.png)

 There are a lot of ways the Merkle tree can be structured (or can be even split up in multiple trees, like a separate tree for the trading history, or a separate tree for the fees). The Merkle tree above has a good balance between complexity, proving times and user-friendliness.

- Only a single account needed for all tokens that are or will be registered
- No special handling for anything. Every actor in the Loopring ecosystem has an account in the same tree.
- A single nonce for every account (instead of e.g. a nonce for every token a user owns) allowing off-chain requests to be ordered on the account level, which is what users will expect.
- While trading, 3 token balances are modified for a user (tokenS, tokenB, tokenF). Because the balances are stored in their own sub-tree, only this smaller sub-tree needs to be updated 3 times. The account itself is modified only a single time (the balances Merkle root is stored inside the account leaf). The same is useful for wallets, ring-matchers and operators because these also pay/receive fees in different tokens.
- The trading history tree is a sub-tree of the token balance. This may seem strange at first, but this is actually very efficient. Because the trading history is stored for tokenS, we already need to update the balance for this token, so updating the trading history only has an extra cost of updating this small sub-tree. The trading-history is not part of the account leaf because that way we'd only have 2^14 leafs for all tokens together. Note that account owners can create [a lot more orders](#Trading-History) for each token than the 2^14 slots available in this tree!


## Blocks

Work of a certain type (e.g. depositing, or ring settlements) is batched together in a block (which is not to be confused with an Ethereum block). All data necessary for all types of work is stored in the Merkle tree. A block changes the Merkle tree from the existing state to the new state by doing the state changes required in all the work in the block. These state changes can be verified on-chain by generating a ZK proof using a circuit. Only the Merkle root is stored on-chain. The actor responsible for creating and committing blocks is called the operator.

### Circuit Permutations

A circuit always does the same. There's no way to do dynamic loops or branching. Let's take the ring settlement circuit as an example:
- The circuit always settles a fixed number of rings
- The rings always contain the predetermined number of orders

We have 5 circuits:
- Ring Settlement (aka Trade)
- Deposit
- Off-chain withdrawal
- On-chain withdrawal
- Order Cancellation

Circuits with and without on-chain data-availability are available. We also support a couple of different block sizes for each circuit type to reduce the proving time without padding too many non-op works (or long delays until the block can be completely filled).

### Committing and Verifying Blocks On-chain

Creating a proof for a block can take a long time. If the proof needs to be available at the same time the state is updated on-chain we limit the maximum throughput of the system by the proof generation time. But we don't need the proof immediately. If a block is committed that isn't verified in time we can easily revert the state by going back to a finalized block which is guaranteed to be a valid state. This allows for
- faster settlement of rings because operators don't need to wait on the proof generation before they can publish the settlements (and thus also the new Merkle tree states) on-chain.
- the parallelization of the  proof generation. Multiple operators can generate a proof at the same time. This isn't possible otherwise because the initial state needs to be known at proof generation time.

We use a simple commit and verify scheme. A block can be in 3 states:
- Committed: The block has been committed on-chain but not yet proven
- Verified: The block has been committed and has been proven, but a block that was committed before this block has not yet been verified.
- Finalized: The block and all previous blocks have been proven.

Proofs do not need to be submitted in order. The proof can be submitted anytime from the start the block was committed until the maximum proof generation time has passed.

There is **NO** risk of losing funds for users. The worst that can happen is that the state is reversed to the latest finalized state. All rings that were settled afterward are automatically reverted by restoring the Merkle roots. Blocks with on-chain requests that were reverted need to be re-submitted and withdrawals are only allowed on finalized blocks.

## Operators

The operator is responsible for creating, committing and proving blocks. Blocks need to be submitted on-chain and the correctness of the work in a block needs to be proven. This is done by creating a proof.

The operator can be a simple Ethereum address or can be a complex contract allowing multiple operators to work together to submit and prove blocks. It is left up to the exchange for how this is set up.

The operator contract can also be used to enforce an off-chain data-availability system. A simple scheme could be that multiple parties need to sign off on a block before it can be committed. This can be checked in the operator contract. As long as one member is trustworthy and actually shares the data then data-availability is ensured.

The operator creates a block and submits it on-chain by calling `commitBlock`. He then has at most `MAX_PROOF_GENERATION_TIME_IN_SECONDS` seconds to submit a proof for the block using `verifyBlock`. A proof can be submitted any time between when the block is committed and `MAX_PROOF_GENERATION_TIME_IN_SECONDS` seconds afterward, verifying a block does not need to be done in the same order as they are committed. If a block isn't proven in time `revertBlock` needs to be called by the operator within `MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE` seconds the block was committed. When a block is successfully reverted the complete stake of the exchange is burned. If the operator fails to call `revertBlock` in time the exchange will automatically go into withdrawal mode. If there are any unverified blocks anyone can call `burnStake` to still burn exchange's stake.

### Restrictions Imposed on the Operator

The operator needs all the order data to generate the proof. We need a way to prevent the operator from re-creating rings with him as the recipient of the ring matching fees.

To allow orders to be matched by any criteria by a ring-matcher we also need a mechanism to prevent operators to re-order the sequence in which the rings are settled while enforcing the ring can only be settled a single time.

#### Restrict Order Matching

We use [dual-authoring](https://medium.com/loopring-protocol/dual-authoring-looprings-solution-to-front-running-d0fc9c348ef1) here. Orders can only be matched in rings signed by the private key corresponding to the public key stored in the order.
For dual-authoring we also use EdDSA keys.

#### Enforced Sequence of Ring Settlements

We use a **nonce**. The nonce of the ring-matcher account paying the operator is used. The ring signed by the ring-matcher contains a nonce. The nonce in the next ring that is settled for this ring-matcher needs to be the nonce of the previous ring that was settled incremented by 1.  A ring-matcher can have multiple accounts to have more control how rings can be processed by the operator (e.g. an account per trading pair).

Note that doing an off-chain withdraw also increments the nonce value. A ring-matcher thus may want to limit himself to on-chain withdrawals so the nonce value of the account remains the same.

#### Only Allow Off-chain Requests to be Used Once

The **nonce** of the account is increased by 1 for these operations. The expected nonce is stored in the off-chain request which is signed by the account owner.

## Exchanges

Block submission needs to be done sequentially so the Merkle tree can be updated from a known old state to a new state. To allow concurrent settling of orders by different independent parties we allow the creation of stand-alone exchange contracts. Every exchange operates completely independently.

Note that user accounts and orders cannot be shared over different exchanges. Exchanges can decide to use the same Exchange contract so orders and users accounts can be shared if they desire.

The Loopring contract is the creator of all exchanges built on top of the Loopring protocol. This contract contains data and functionality shared over all exchanges (like the token tiers for the burn rate) and also enforces some very limited restrictions on exchanges (like a maximum withdrawal fee).

### Exchange Creation

Anyone can create a new exchange by calling `createExchange` on the Loopring contract. A small amount of LRC may need to be burned to create a new exchange.

Exchange has an owner and an operator. The owner is the only one who can call some functions related to the more business side of things, like registering tokens, putting the exchange in maintenance mode and setting the operator. The operator is responsible for committing and proving blocks.

### Exchange Staking

An exchange stakes LRC. Anyone can add to the stake of an exchange by calling `depositStake`, withdrawing the stake however is only allowed when the exchange is completely [shut down](#exchange-shutdown).

The stake ensures that the exchange behaves correctly. This is done by
- burning the complete stake if a block isn't proven in time
- using a part of the stake to ensure the operator automatically distributes the withdrawals of users
- only allows the stake to be withdrawn when the exchange is shut down by automatically returning the funds of all its users

Exchanges with a large stake have a lot to lose by not playing by the rules and have nothing to gain because the operator/owner can never steal funds for itself.

### Exchange Shutdown

The exchange owner can choose to shut down the exchange at any time. However, the stake of an exchange can only be withdrawn when the exchange was shut down completely by returning all funds back to the users. This is done as follows:
- The exchange owner calls `shutdown` on the exchange contract. This will disallow new on-chain requests by users.
- First, all remaining open on-chain deposit requests need to be processed
- From this point on only special on-chain withdrawal blocks can be committed. These withdrawals not only withdraw the balance for a token in an account, they also reset the trading history root, the account public key, and the account nonce back to the default values of the Merkle tree
- Once the complete tree is reset to its initial state (`lastBlock.merkleRoot == genesisBlock.merkleRoot`) the exchange owner is allowed to withdraw the full stake by calling `withdrawStake`.

An exchange that is shutdown only has a limited amount of time to revert the state back to the initial state before we go into [withdrawal mode](#withdrawal-mode). This maximum amount of time can be calculated as follows:
```
maxTimeInShutdown = MAX_TIME_IN_SHUTDOWN_BASE + (numAccounts * MAX_TIME_IN_SHUTDOWN_DELTA)
```
In general, the more accounts an exchange has the more withdrawals need to be done when the exchange is shutdown. We also want to limit this amount of time because otherwise funds from users could be stuck for a long time.

This mechanism also guards users against data-availability problems. Even if the Merkle tree cannot be rebuilt by anyone but the operator, this mechanism still ensures all funds will be returned to the users, otherwise, the exchange loses the amount staked.

### Maintenance Mode

The exchange owner can put the exchange temporarily in a suspended state. This can, for example, be used to update the back-end of the exchange.

When the exchange is suspended users cannot do any on-chain requests anymore. Additionally, the operator is not allowed to commit any ring settlement blocks to prevent the exchange owner from abusing this system. The operator still needs to process all on-chain requests that are still open and needs to prove any unverified blocks, otherwise, the exchange runs the risk of getting into withdrawal mode, which is irreversible.

The exchange owner can call `purchaseDowntime` to burn LRC in return for downtime. `getDowntimeCostLRC` can be used to find out how much LRC needs to be sent to put the exchange in downtime for a certain amount of time. `purchaseDowntime` can be called multiple times to extend the downtime. `getRemainingDowntime` can be called to find out how much time the exchange will still remain in maintenance mode.

The exchange will get out of the maintenance mode automatically after all downtime has been used. There is currently no way to force the exchange out of this mode immediately, which can be improved in future releases.

### Token Registration

Before a token can be used in the exchange it needs to be registered, so a small token ID of 1 or 2 bytes can be used instead. Only the exchange owner can register tokens by calling `registerToken`. We ensure a token can only be registered once. ETH, WETH, and LRC are registered when the exchange is created.

We limit the token ID to just 8 bits (i.e. a maximum of ETH + 255 tokens) to increase the performance of the circuits. It's possible that a small amount of LRC needs to be burned for registering a token. This can be checked by calling `getLRCFeeForRegisteringOneMoreToken`, this is however left up to the Loopring contract.

### Token Deposit Disabling

The exchange owner can disable deposits of a certain token by calling `disableTokenDeposit`. Depositing can be enabled again by calling `enableTokenDeposit`. This can be useful to stop supporting a certain token. Withdrawals for a token can never be disabled (unless temporarily in [maintenance mode](#maintenance-mode)).

### On-chain Fees

The owner of the exchange can set the fees for his exchange by calling `setFees`.

The following on-chain requests can require a fee to be paid in ETH to the exchange:
- Account creation
- Account update
- Depositing
- Withdrawing

An exchange is allowed to freely set the fees for any of the above. However, for withdrawals, the Loopring contract enforces a maximum fee. This is to ensure an exchange cannot stop users from withdrawing by setting an extremely high withdrawal fee.

Any function requiring a fee on-chain can be sent ETH. If the user sends more ETH than required (e.g. because the exact fee amount in hard to manually set) then the surplus is immediately sent back.

## Fee Model

We support the [flexible fee model introduced in protocol 2](https://medium.com/loopring-protocol/explaining-looprings-new-fee-model-b48b89a58858) for trading. Using this model the trading fee can be paid in any token, but certain tokens have a lower burn rate than others.

The token tiers are stored in the Loopring contract. All tokens are tier 4 by default, but 3 tokens have a fixed tier:
- ETH: tier 3
- WETH: tier 3
- LRC: tier 1

LRC has the lowest burn rate by default. The burn rate for a token can be lowered by upgrading the tier of the token. This can be done by calling `buydownTokenBurnRate`. The cost to upgrade the token a single tier is `tierUpgradeCostBips * LRC.totalSupply()`. The burn rate for a token can be found by calling `getTokenBurnRate`.

Only the fees paid by the order owners are subject to fee burning; margins are not. The business model among wallets, ring-matchers, and operators can be negotiated off-chain and can be totally detached from the protocol.

## Signatures

Currently, we use EdDSA keys (7,000 constraints to verify a signature), which is a bit cheaper than ECDSA signatures (estimated to be ~12,000 constraints). We may switch to ECDSA signatures if possible because users would not need to create (and store) a separate trading keypair.

The introduction of trading keypairs does have a benefit: orders no longer need to be signed by a user's Ethereum private key, DEX interfaces thus no longer need access to those Ethereum private keys. This is more secure for both users and DEXes.

The data for an EdDSA signature is stored like this:

```
Signature {
  Rx (256bit)
  Ry (256bit)
  s (256bit)
}
```

## Account Creation

Before the user can start trading he needs to create an account. An account allows a user to trade any token that is registered (or will be registered in the future).
The account is linked to the `msg.sender` that created the account, creating a one-to-one mapping between Ethereum addresses and accounts. Any future interaction with the account on-chain that needs authentication needs to be done using the same `msg.sender`.

The account needs an EdDSA public key. This public key will be stored in the Merkle tree for the account. Every request made for the account in off-chain requests (like orders) needs to be signed using the corresponding private key.

An account can be created using `createOrUpdateAccount`. When creating an account a user can also immediately deposit funds using `updateAccountAndDeposit` as both are handled by the same circuit. `updateAccountAndDeposit` can also be used by users to update the EdDSA public key which is used for signing off-chain requests.

If the account is used to receive fees that are subject to fee-burning (i.e. all fees except the margin and the fee paid by the ring-matcher to the operator), then the account needs to be a special fee-recipient account. This type of account can be created by calling `createFeeRecipientAccount`.

## Depositing

A user can deposit funds by calling `deposit`. If ERC-20 tokens are deposited the user first needs to approve the Exchange contract so the contract can transfer them to the contract using `transferFrom`. **ETH is supported**, no need to wrap it in WETH when using off-chain balances.

A user can also choose to deposit to the account of someone else by calling `depositTo`.

The balance for the token in the account will be updated once it's included in a block. See [here](#on-chain-depositwithdraw-request-handling) how on-chain requests are handled.

We store the deposit information on-chain so users can withdraw from these deposited balances in withdrawal mode when the request didn't get included in a finalized block (see [withdrawal mode](#withdrawal-mode)).

## Withdrawing

The user requests a withdrawal either on-chain or off-chain by sending the operator a withdrawal request. Once the operator has included this request in a block and the block is finalized the tokens can be withdrawn by anyone by calling `withdrawFromApprovedWithdrawal` (and the tokens will be sent to the account owner).

### Automatic Distribution of Withdrawals

Normally users should not need to call `withdrawFromApprovedWithdrawal` manually. The operator should call `distributeWithdrawals` `MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS` seconds after the withdrawal block was committed. This will distribute all tokens that were withdrawn to the corresponding account owners without any further interaction of the account owner himself. If the operator fails to do so in time, anyone will be able to call the function. The exchange is fined for this by withdrawing a part of the exchange stake for every withdrawal included in the block:
```
totalFine = Loopring.withdrawalFineLRC() * numWithdrawalRequestsInBlock
```
50% of the fine is used to reward the caller of the function for distributing the withdrawals, the other 50% is burned.

### Fee Burning

When withdrawing funds from a fee-recipient account a part of the balance is [burned](#fee-model). If the token is LRC we burn the amount immediately by calling `burn` on the LRC token contract, otherwise we send the amount to the Loopring contract. There it can be withdrawn by the Loopring contract owner by calling `withdrawTheBurn` so that it can be used to buy LRC and burn it. In the future, these funds will be sold directly on-chain in a decentralized way by using [Loopring's Oedax (Open-Ended Dutch Auction eXchange) protocol](https://medium.com/loopring-protocol/oedax-looprings-open-ended-dutch-auction-exchange-model-d92cebbd3667).

### Off-chain Withdrawal Request

A request for a withdrawal is sent off-chain to the operator. The operator should include the withdrawal in a reasonable time in a block, though no guarantees can be made to the user when it will be included. **The user can pay a fee in any token he wants to the operator.** The wallet can receive a part of the fee paid to the operator.

The nonce of the account is increased after the withdrawal is processed.

```
OffchainWithdrawal {
  exchangeID (32bit)
  accountID (20bit)
  tokenID (8bit)
  amount (96bit)
  walletAccountID (20bit)
  feeTokenID (8bit)
  fee (96bit)
  walletSplitPercentage (7bit)
  nonce (32bit)
}
```

An off-chain withdrawal is hashed using Pedersen in the sequence given above. The hash is signed by the Owner using the private key associated with the public key stored in `account[accountID]` with EdDSA

```
SignedOffchainWithdrawal {
  OffchainWithdrawal offChainWithdrawal
  Signature sig
}
```

`SignedOffchainWithdrawal`s can be sent to the Operators for commitment.

### On-chain Withdrawal Request

A user calls `withdraw` and the request is added to the withdrawal chain. See [here](#on-chain-depositwithdraw-request-handling) how on-chain requests are handled.

## Ring Settlement

The ring settlement is just as in protocol 2 with some limitations:
- Only 2-order rings
- No P2P orders (always use fee token)
- No on-chain registration of orders
- No fee waiving mechanism with negative percentages (which would pay using order fees, greatly increasing the number of constraints)

Orders and order-matching are still completely off-chain.

**Rings are automatically scaled** to fill the orders as much as possible with the funds available in the Merkle tree at the time of settlement. The order that pays the margin (if there is any) needs to be the first order in the ring (we use the price of the second order as the trading price).

**Partial order filling** is fully supported. How much an order is filled is [stored in the Merkle tree](#Trading-History). No need for users to re-sign anything if the order wasn't filled completely in a single ring, a user only needs to sign his order a single time. The order can be included in as many rings as necessary until it is completely filled.

### Rings Accepted in the Circuit

Only 'valid' rings can be included in a circuit. With 'valid' we mean rings and orders that are completely valid (signatures correct, order data correct,...), but may not result in actually filling the orders. As a general rule of thumb: if the ring-matcher cannot fully control the parameter used for the rings settlement we allow the ring settlement to gently fail by not doing any token transfers. Rings that are never valid cannot be included in a block.

List of causes that will result in no actual ring settlement, but are still accepted by the circuit:
- An order is expired
- An order is canceled
- An order is already completely filled
- An `allOrNone` order cannot be completely filled
- The fill amounts have rounding error that is too large
- The amount sold is 0 or the amount bought is 0
- The account owner of an order does not have enough funds
- The orders cannot be matched correctly

For these types of rings, a fee is still collected by the operator from the ring-matcher's accounts.

### Off-chain Data

#### Orders
```
Order {
  exchangeID (32bit)
  orderID (32bit)
  accountID (20bit)
  walletAccountID (20bit)
  dualAuthPublicKeyX (254bit)
  dualAuthPublicKeyY (254bit)
  tokenS (8bit)
  tokenB (8bit)
  tokenF (8bit)
  amountS (96bit)
  amountB (96bit)
  amountF (96bit)
  allOrNone (1bit)
  validSince (32bit)
  validUntil (32bit)
  walletSplitPercentage (7bit)
}
```

An order is hashed using Pedersen in the sequence given above. The hash is signed by the order Owner using the private key associated with the public key stored in `account[accountID]` with EdDSA.

```
SignedOrder {
  Order order
  Signature sig
  [Optional] dualAuthPrivateKey (256bit)
}
```

`SignedOrder`s can be sent to Ring-Matchers for matching. Optionally the dual-author private key can be sent to ring-matcher so the ring-matcher can sign rings using the order.

#### Rings

```
Ring {
  orderA_hash (254bit)
  orderB_hash (254bit)
  orderA_waiveFeePercentage (7bit)
  orderB_waiveFeePercentage (7bit)
  accountID (20bit)
  tokenID (8bit)
  fee (96bit)
  feeRecipientAccountID (20bit)
  nonce (32bit)
}
```

A ring is hashed using Pedersen in the sequence given above. The hash is signed by
- by the Ring-Matcher using the private key associated with the public key stored in `account[accountID]` with EdDSA
- by the dual-author private key of orderA with EdDSA
- by the dual-author private key of orderB with EdDSA

```
SignedRing {
  Order orderA
  Order orderB
  Ring ring
  Signature sigRingMatcher
  Signature sigDualAuthorA
  Signature sigDualAuthorB
}
```

`SignedRing`s can be sent to the Operators for settlement.

## Canceling Orders

There are many ways an order can be canceled.

### Limit Validity in Time

Orders can be short-lived and the order owner can safely keep recreating orders with new validSince/validUntil times using [Order Aliasing](#Order-Aliasing) as long as they need to be kept alive.

### Off-chain Order Cancellaton Request

The user sends a request for canceling an order. The operator should include the cancellation as soon as possible in a block, though no guarantees can be made to the user when it will be included. **The user can pay a fee in any token he wants to the operator.** The wallet can receive a part of the fee paid to the operator.

The nonce of the account is increased after the cancel is processed.

```
CancelRequest {
  exchangeID (32bit)
  accountID (20bit)
  orderTokenID (8bit)
  orderID (32bit)
  walletAccountID (20bit)
  feeTokenID (8bit)
  fee (96bit)
  walletSplitPercentage (7bit)
  nonce (32bit)
  zero-padding (2bit)
}
```

A cancel request is hashed using Pedersen in the sequence given above. The hash is signed by the Owner using the private key associated with the public key stored in `account[accountID]` with EdDSA

```
SignedCancelRequest {
  CancelRequest cancelRequest
  Signature sig
}
```

`SignedCancelRequest`s can be sent to the Operators for commitment.

### Updating the Account Info

The account information can be updated with a new EdDSA public key which invalidates all orders and off-chain requests of the account.

### The party with the dual-author keys stops signing rings containing the order

Only the party with the dual-author keys can actually use the order in a ring. Especially in an order-sharing setup like described [here](#Order-sharing-with-Dual-Authoring) this would be very useful. Anybody can become a 'Wallet' and create orders using their own personal dual-author addresses so they remain in complete control of their orders.

### Creating an order with a larger orderID in the same trading history slot

If an order with a larger orderID is used in a ring settlement at the same trading history slot as a previous order, the previous order is automatically canceled. Please read [Trading History](#Trading-History) to learn more about how the trading history is stored.

### The DEX removes the order in the order-book

If the order never left the DEX and the user trusts the DEX then the order can simply be removed from the order book.

## Trading History

Every account has a trading history tree with 2^14 leafs **for every token**. Which leaf is used for storing the trading history for an order is completely left up to the user, and we call this the **orderID**. The orderID is stored in a 20-bit value. We allow the user to overwrite the existing trading history stored at `orderID % 2^14` if `order.orderID > tradeHistory.orderID`. If `order.orderID < tradeHistory.orderID` the order is automatically canceled. If `order.orderID == tradeHistory.orderID` we use the trading history stored in the leaf. This allows the account to create 2^20 unique orders for every token, the only limitation is that only 2^14 of these orders selling a certain token can be active at the same time.

While this was done for performance reasons (so we don't have to have a trading history tree with a large depth using the order hash as an address) this does open up some interesting possibilities.

### Order Aliasing

The account owner can choose to reuse the same orderID in multiple orders. We call this Order Aliasing.

#### Safely updating the validUntil time of an order

For safety the order owner can limit the time an order is valid, and increase the time whenever he wants safely by creating a new order with a new validUntil value, without having to worry if both orders can be filled separately. This is done just by letting both orders use the same orderID.

This is especially a problem because [the operator can set the timestamp](#Timestamp-in-Circuits) that is tested on-chain within a certain window. So even when the validSince/validUntil times don't overlap it could still be possible for an operator to fill multiple orders. The order owner also doesn't know how much the first order is going to be filled until it is invalid. Until then, he cannot create the new order if he doesn't want to buy/sell more than he actually wants. Order Aliasing fixes this problem without having to calculate multiple hashes (e.g. order hash with time information and without).

#### The possibility for some simple filling logic between orders

A user could create an order selling X tokenZ for either N tokenA or M tokenB (or even more tokens) while using the same orderID. The user is guaranteed never to spend more than X tokenZ, but will have bought [0, N] tokenA and/or [0, M] tokenA.

A realistic use case would be for selling some token for one of the available stable coins. Or selling some token for ETH and WETH. In these cases the user doesn't really care which specific token he buys, but he increases his chance of finding a matching order.

## On-chain Deposit/Withdraw Request Handling

On-chain deposit and withdrawal requests are added to a small 'blockchain' on-chain. We use separate chains for deposits and withdrawals. For every request we store the following:
- The accumulated hash: The hash of the request data hashed together with the accumulated hash of the previous request.
- The accumulated fee: The fee of the request added to the  accumulated fee of the previous request.
- The timestamp the request was added.

This setup allows the operator to process any number of requests in a block that he wants (though only a limited number of requests/block type are supported to limit the number of circuits, padding is done when needed). The circuits use the starting accumulated hash and the ending accumulated hash (after padding) as public input. The fee the operator receives for all the requests can easily be calculated by subtracting the accumulated fees of the last and first requests.

All requests are handled FIFO in their corresponding chain (deposit or withdrawal chain).

Once the block containing the deposits/withdrawals is finalized the operator can call `withdrawBlockFee` to collect the fee earned by processing the requests.

Because we want on-chain requests to be handled as quickly as possible by the operator, we enforce some limitations on him. However, we also don't want to let operators be overwhelmed by the number of on-chain requests. The following rules apply:
- The maximum number of open on-chain requests is limited by `MAX_OPEN_DEPOSIT_REQUESTS` and `MAX_OPEN_WITHDRAWAL_REQUESTS`. Anyone can check if there are available slots by calling `getNumAvailableWithdrawalSlots` or `getNumAvailableDepositSlots`.
- If there is an open on-chain request older than `MAX_AGE_REQUEST_UNTIL_FORCED` then the operator can only commit blocks containing requests like this. Priority is given to withdrawals if there are deposit and withdrawal requests forced.
- The total fee paid to the operator (the sum of all fees of all requests processed in the block) is reduced the older the requests in the block are. As a starting point for this reduction, the last processed request in the block is used. If the block is committed less than `FEE_BLOCK_FINE_START_TIME` seconds afterward the operator receives the complete fee. If not, the fee is linearly reduced for a total time of `FEE_BLOCK_FINE_MAX_DURATION`. From then on the operator does not receive any fee at all. The fine paid by the operator is burned (i.e. sold for LRC and then the LRC is burned).
- If any request that is still open is older than `MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE` we automatically go into withdrawal mode.

Current values:
```
function MAX_OPEN_DEPOSIT_REQUESTS() internal pure returns (uint16) { return 1024; }
function MAX_OPEN_WITHDRAWAL_REQUESTS() internal pure returns (uint16) { return 1024; }
function MAX_AGE_REQUEST_UNTIL_FORCED() internal pure returns (uint32) { return 15 minutes; }
function MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() internal pure returns (uint32) { return 1 days; }
function FEE_BLOCK_FINE_START_TIME() internal pure returns (uint32) { return 5 minutes; }
function FEE_BLOCK_FINE_MAX_DURATION() internal pure returns (uint32) { return 30 minutes; }
```

## Withdrawal Mode

The operator may stop submitting new blocks and proofs at any time. If that happens we need to ensure users can still withdraw their funds.

Exchange can go in withdrawal mode when any of the conditions below are true:
- An on-chain request (either deposit or withdrawal) is open for longer than `MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE`
- A block remains unfinalized for longer than `MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE`

Once in withdrawal mode, almost all functionality of the exchange is stopped. The operator cannot commit any blocks anymore.
Users can withdraw their funds using the state of the last finalized block:
- Balances still stored in the Merkle tree can be withdrawn with a Merkle proof by calling `withdrawFromMerkleTree` or `withdrawFromMerkleTreeFor`.
- Deposits not yet included in a finalized block can be withdrawn using `withdrawFromDepositRequest`
- Approved withdrawals can manually be withdrawn (even when not in withdrawal mode) using `withdrawFromApprovedWithdrawal`

## Wallets

Wallets are where users create orders. The wallet can insert its account to receive a part of the fees paid by the order owner.

Wallets need to create a fee-recipient account to receive the wallet fees of the order. This account can be included in the order.

## Ring-Matchers

Ring-matchers collect as many orders as possible sent to him by wallets (or created by himself). In this large pool of orders he finds 2 (or more, depending on the protocol version) orders that can be matched with each other (so the orders are filled as expected by the users, this is enforced by the protocol). We call this a ring.

Ring-matchers need to create a normal account so they can pay the operator (and receive the burn rate free margin). They also need to create a fee-recipient account
to receive the matching fee from orders (because the burn rate needs to be applied on these funds when withdrawing).

The fee paid by the ring-matcher to the operator is completely independent of the fee paid by the orders. Just like in protocol 2 the ring-matchers pays a fee in ETH to the Ethereum miners, the ring-matcher now pays a fee to the operator. **Any registered token can be used to pay the fee.**

## Brokers

A broker is someone that can manage orders for an account it does not own.

The account system is used for this. Users can create a special account for a broker and deposit funds the broker is able to use. This is done by setting `account.publicKey` to the public key of the broker instead of the order owner. To stop the broker from being able to fill orders the balance can be withdrawn or the public key stored in the account can be changed.

## Timestamp in Circuits

A block and its proof are always made for a fixed input. The operator cannot accurately know on what timestamp the block will be processed on the Ethereum blockchain, but he needs a fixed timestamp to create a block and its proof (the chosen timestamp impacts which orders are valid and invalid).

We do however know the approximate time the block will be committed on the Ethereum blockchain. When committing the block the operator also includes the timestamp he used in the block (as a part of the public data). This timestamp is checked against the timestamp on-chain and if the difference is less than `TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS` the block can be committed.

## On-chain Data

From the yellow paper:
- 4 gas is paid for every zero byte of data or code for a transaction
- 68 gas is paid for every non-zero byte of data or code for a transaction

In the calculations below we use 68 gas/byte for our data-availability data.

#### Data-availability for ring settlements

```
- Operator account ID: 3 bytes
- For every ring
    - Ring-matcher account ID: 2,5 bytes
    - Fee: 1,5 bytes
    - Fee Token ID (fee to operator): 1 bytes
    - Spread: 3 bytes
    - For both Orders:
        - Account ID: 2,5 bytes
        - Wallet account ID: 2,5 bytes
        - Order ID: 2,5 bytes
        - TokenS: 1 bytes
        - FillS: 3 bytes
        - feeBips: 1 byte
        - WalletSplitPercentage: 1 byte
```
=> **35 bytes/ring**
=> Calldata cost: (8 + 2 * 13,5) * 68 = **2380 gas/ring**

#### Data-availability for order cancellations
```
- Operator account ID: 3 bytes
- For every cancel:
    - Account ID: 2,5 bytes
    - Wallet Account ID: 2,5 bytes
    - Token ID: 1 bytes
    - Order ID: 3 bytes
    - Fee token ID: 1 bytes
    - Fee amount: 2 bytes
    - WalletSplitPercentage: 1 byte
```
- => **13 bytes/cancel**
- => Calldata cost: 13 * 68 = **884 gas/cancel**


#### Withdrawal data
```
// Approved withdrawal data
- For every withdrawal:
    - Token ID: 1 bytes
    - Account ID: 2,5 bytes
    - Amount: 3,5 bytes

// Data-availability
- Operator account ID: 3 bytes
- For every withdrawal:
    - Wallet account ID: 3 bytes
    - Fee token ID: 1 bytes
    - Fee amount: 2 bytes
    - WalletSplitPercentage: 1 byte
```
- => On-chain: **7 bytes/withdrawal**
- => On-chain withdrawal calldata cost: 7 * 68 = **476 gas/on-chain withdrawal**
- => With data-availability: **14 bytes/withdrawal**
- => With data-availability calldata cost: 14 * 68 = **952 gas/off-chain withdrawal**


The approved withdrawal calldata also needs to be stored on-chain so that the data can be used when actually withdrawing the tokens when allowed (storing 32 bytes of data costs 20,000 gas):
- => Data storage cost: (7 / 32) * 20,000 = **4,375 gas/withdrawal**

## Throughput (Ring Settlements)

The throughput is limited by:

- The cost of the data we have to send in the calldata for the on-chain data-availability.
- The 256,000,000 constraints limit that allows efficient proof verification on-on-chain.

Without data-availability, we are only limited by the number of constraints in a single block.

The gas limit in an Ethereum block is 8,000,000 gas. An Ethereum block is generated every ~15 seconds.

### On-chain Data-availability Limit

- Verifying a proof + some state updates/querying: ~600,000 gas
- => (8,000,000 - 600,000) / 3,128 = **2365 rings/Ethereum block = ~160 rings/second**

### Constraints Limit

We can only prove circuits with a maximum of 256,000,000 constraints on-chain efficiently.

Currently, our **most expensive** ring settlement circuit with data-availability support uses ~500,000 constraints/ring:
- 256,000,000 / ~500,000 = ~500 rings/block

Our **most expensive** ring settlement circuit without data-availability support uses ~475,000 constraints/ring (this is cheaper than with data-availability because we don't have to hash the data-availability data in the circuit):
- 256,000,000 / ~475,000 = ~550 rings/block

### Results

In a single block, we are currently limited by the number of constraints used in the circuit. Verifying a proof costs _only_ ~600,000 gas so multiple blocks can be committed if needed.

Using 4 blocks with on-chain data-availability (so that we are limited by the cost of data-availability):
- => (8,000,000 - 600,000 * 4) / 3,128 = ~1800 rings/Ethereum block = **~120 rings/second**

Without data-availability we are limited by how many blocks (and thus by how many rings/block) we can verify in a single Ethereum block:
- => 8,000,000 / 600,000 = ~13 blocks/Ethereum block
- = ~550 rings/block * 13 blocks/Ethereum block = ~7000 rings/Ethereum block = **~450 rings/second**

For comparison, let's calculate the achievable throughput of the previous Loopring protocols that did the ring settlements completely on-chain.
- Gas cost/ring settlement: ~300,000 gas
- => 8,000,000 / 300,000 = 26 rings/Ethereum block = **~2 rings/second**.




|  | Loopring 2.x | Loopring 3.0 <br> (w/ Data Availability) | Loopring 3.0 <br> (w/o Data Availability)  |
| :----- |:-------------: |:---------------:| :-------------:|
|Trades per Ethereum Block | ~26      | ~1800 |      ~7000|
| Trades per Second | ~2      | ~120        |           ~450 |
| Cost per Trade | ~300,000 gas | ~4450 gas | ~1150 gas|
| Cost in USD per Trade <br> (1ETH=164USD) | ~0.1 | ~0.0015* | ~0.0004* |

* *Cost in USD per Trade* in the table does not cover off-chain proof generation.

### Future Improvements

These numbers will improve significantly, even in the near future.
- [More efficient hash functions](https://github.com/Loopring/protocols/issues/49) may be usable which would drastically decrease the number of constraints.
- Our fee model is quite complex, using **a lot** of token transfers. We can create circuits with a [simplified fee model](https://github.com/Loopring/protocols/issues/50). This, again, will greatly decrease the number of constraints.

With these improvements we will be able to do **~10,000-20,000 rings/Ethereum block or ~1000 rings/second** without on-chain data-availability. And this is even without [recursive SNARKs](https://ethresear.ch/t/reducing-the-verification-cost-of-a-snark-through-hierarchical-aggregation/5128). Once this is possible on Ethereum the throughput can increase another order of magnitude.

For an order of magnitude improvement with on-chain data-availability we are dependent on Ethereum. [Proposals](https://ethereum-magicians.org/t/reduce-the-cost-of-transaction-data/2868) to lower the calldata cost are already in the making.

### Proof Generation Cost

From [Matter Labs](https://medium.com/matter-labs/introducing-matter-testnet-502fab5a6f17):
> [about circuits with 256 million constraints] "the computation took 20 minutes on a 72-core AWS server".

> At the target latency of 5 min at 100 TPS we estimate the off-chain part to be approximately 0.001 USD. This estimate is very conservative.

Ring settlements are ~5x more expensive than simple token transfers, but this will still be pretty cheap.


# Case Studies

## DEX with CEX-like Experience

### Setting up the exchange

The DEX can decide to use an existing exchange so it does not need to set up its own infrastructure to handle block creation and creating proofs. This also makes it possible to share orders with all other parties using that exchange.

In this case study, let's create a new exchange. The exchange owner just needs to call `createExchange` on the Loopring contract. This creates a brand new exchange contract.

### Trading

Users create orders using accounts created on the exchange. Orders are added to the order books of the DEX.

The DEX matches the order with another order, signs the ring using the ring-matcher private key and the dual-author keys of the orders. The order gets completely filled in the ring:
- The GUI of the DEX can be updated immediately with the state after the ring settlement. The order can be shown as filled, but not yet verified.
- The DEX sends the ring to the operator(s) of the exchange. Because these rings need to be settled in a reasonable time the operator needs to call `commitBlock` soon after receiving rings.
- The operator generates proofs and calls `verifyBlock` within the maximum time allowed

The DEX could now show an extra 'Verified" symbol for the filling of the order.

An order can be in the following states:
- **Unmatched** in an order-book
- **Matched** by the DEX
- **Committed** in a block sent in `commitBlock`
- **Verified** in a block with a proof in `verifyBlock`
- **Finalized** when the block it was in is finalized (so all blocks before and including the block containing the ring settlement are verified)

Only when the block is finalized is the ring settlement irreversible.

## Deposit and Withdrawal Process

The first thing a user needs to do is create an account. The user has the option to directly deposit tokens to this new account to be created.

`updateAccountAndDeposit` is called on the exchange contract. A new account is created on-chain (the on-chain account information does not contain any balance information because the balance will only be used and updated in the Merkle tree) and the necessary data is hashed together that needs to be used for creating the account in the Merkle tree in the circuit. The amount of tokens the user deposits to the contract will be stored in the leaf of the Merkle tree with address `accountID` (together with the rest of the account information).

The Merkle tree has not yet been updated. This needs to be done by the operator by committing a deposit block containing the deposit by the user. As long as the account is not added to the Merkle tree the account cannot be used.

The operator can stop working before this is done, however. That's why the amount deposited is stored somewhere on-chain so that the user can withdraw these funds in withdrawal mode.

But the operator wants to earn fees so he creates a block that adds the account to the Merkle tree. After the account is added in the circuit, it can immediately be used.

The account balance is updated between trades as you'd expect.

The user then wants to withdraw (a part of) the balance. He can let the operator know on-chain, or he can just send a request off-chain. The only difference is that when the request is made off-chain the operator can choose when to do the withdrawal so there is no guarantee when it will be done. In any case, there will be a delay between the request for withdrawal and when the operator includes the withdrawal in a block. In this period the operator is free to keep using the balances in the account to settle rings.

After some time the operator includes the withdrawal in a block. Two things are done when this happens:
- The balance in the Accounts Merkle tree is subtracted with the amount withdrawn in the circuit (if possible of course, otherwise nothing is withdrawn)
- The smart contract adds the amount that is withdrawn to a list stored on-chain.

The withdrawn amount is stored in a list because the user is still not able to actually withdraw it yet! The user is only allowed to withdraw it when the block is finalized, which means that the block can never be reverted.

This mechanism is needed to support delayed proof submission. If the proof is available immediately when the block is committed the new state would always be verified valid and the amount that can be withdrawn correctly. But with delayed proof submission, we are only certain the block is correct and irreversible when all blocks before it and including the block containing the withdrawal are proven.

Once the operators have submitted all the proofs necessary for the block containing the withdrawal to be finalized, the user is finally able to call `withdrawFromApprovedWithdrawal` on-chain with the necessary information when the withdrawal was done to get the tokens out of the smart contract.

Let's now look at the case where the withdrawal request was done by an operator, but the block containing the withdrawal needs to be reverted. Two things happen automatically by the revert:
- The Merkle tree root is restored as it was before the withdrawal. The balance is restored.
- The list of withdrawals we stored on-chain for the reverted block is thrown away when reverting. A user was never able to withdraw from these in `withdrawFromApprovedWithdrawal` because the block associated with the withdraw list was never marked as finalized.

## Order Sharing with Dual-Authoring

Very similar as in protocol 2, but used a bit differently.

Automatically sharing orders between DEXs can be problematic, mainly because of collisions. For example, DEX B could decide it wants to use an order of DEX A and creates a ring and sends it to the operator. But at the same time, DEX C could have also decided to use the same order in a different ring. In the best case, both rings can be settled. But it's also possible only one of the rings can be settled because the shared order cannot be filled for the fill-amount specified in the second ring. Or because the balance of the order owners isn't sufficient anymore. This uncertainty makes it so that a DEX needs to wait longer to show the result of a trade to the user. It's also hard for a DEX to track the state of a shared order and of the balances of its users if they can be modified at any time without is knowledge.

A solution for this could be dual authoring. But, we don't share the dual author keys with anyone. When a ring-matcher wants to create a ring using orders of wallet A and wallet B then the ring needs to be signed by wallet A **and** wallet B **independently**. This negotiation would be completely off-chain.

The protocol would be something like this. DEX A signs a ring using orders of DEX A and DEX B and sends it to DEX B. DEX B can now decide if he wants to share the order with DEX A or not in the given ring. If not, DEX B simply sends a message back that there is no deal. If DEX B does want to share the order, he can sign the ring as well. The ring is now signed by DEX A and DEX B (the DEXs of the orders in the ring) and the ring can be sent to the operator for settlement. DEX B now sends the doubly signed ring back to DEX A so the DEX can be sure the ring will be settled (or DEX A could just monitor the rings submitted to the operators).

This process should be very fast. The delay between the initial request and knowing whether the ring can be settled should take at most seconds. DEXs also know exactly the state each order is in or is going to be in because every shared order still needs to pass through the DEX it is from.

The protocol could allow the payment of an additional fee for the use of the order. How much fee is paid for the use of the order is completely left up to the DEXs/wallets/ring-matchers. If DEX A has an order, and DEX B **and** DEX C wants to use it, then DEX A can choose the DEX that offers the most fees for the order.

A scenario where this would be very helpful is for a service that offers liquidity from some place (e.g. a bot for a CEX). This service would offer orders to multiple DEXs and can decide on any criteria how it wants to share its orders.

![Order sharing](https://i.imgur.com/2XrQHLa.png)

- **Red arrows**: order sharing by negotiation (needs to be online to share orders)
- **Black arrows**: order sharing by sharing the dual author key (does not need to be online to share orders)

Simple wallets probably don't want to pay for the infrastructure to sign rings all the time for sharing their orders. So these will still share the dual author keys. But to prevent collisions etc... they should only share the keys with a single ring-matcher/DEX.

This order sharing is only possible when orders are created for the same exchange contract, so it's a big advantage for multiple parties to decide to use the same Exchange contract to maximize liquidity.

Recap:
- DEXs/Wallets/Ring-matchers can keep track of his orders and the balances of his users because every order that is used needs to pass through him
- Orders are canceled by not signing any rings anymore with the order, which only the party with the dual-author keys stored in the order can do.
- No collisions (if all parties act correctly).
- Fine-grained order sharing with the possibility of a fee.
- Same order can be shared multiple times in multiple rings with multiple parties.
