
# Loopring 3.0

## Introduction
In Loopring Protocol 3 we want to improve the throughput of the protocol significantly. We do this by using zk-SNARKs -- as much work as possible is done offchain, and we only verify the work onchain.

For the best performance, we only support offchain balances. These are balances that are stored in Merkle trees. Users can deposit and withdraw tokens to our smart contracts, and their balance will be updated in the Merkle trees. This way we can transfer tokens between users just by updating the Merkle tree offchain, there is no need for expensive token transfers onchain.

In the long run, we still want to support onchain transfers due to reasons such as:

- It may be impossible to deposit/withdraw security tokens to the smart contract
- Users may prefer to keep funds in their regular wallets for security reasons

Note that there is never any risk of losing funds when depositing to the smart contract. Both options are trustless and secure.

Data availability for all Merkle trees is an option that can be turned on or off by operators. When data availability is enabled, anyone can recreate the Merkle trees just by using the data published onchain.

## New Development

Things change quickly.

One of the main drawbacks of SNARKs compared to STARKs is the trusted setup. This problem seems to be largely solved. ([Sonic: Nearly Trustless Setup](https://www.benthamsgaze.org/2019/02/07/introducing-sonic-a-practical-zk-snark-with-a-nearly-trustless-setup/)). It remains to be seen if the better proving times of STARKs will be important in the future or not (proving times for SNARKs may be a non-issue or could be improved as well).

Bellman is also being used more and more instead of libsnark for creating the circuits. They work mostly the same (manually programming the constraints). We should use the library/framework with the best support and best features. Currently, I feel this is still libsnark.

## Trading with Offchain Balances

### Immediate finality
Offchain balances are guaranteed to be available for a short time in the future (until a withdrawal), which enables a CEX like experience. A DEX can settle a ring offchain and immediately show the final results to the user without having to wait for the onchain settlement confirmation. Using onchain balances, users can modify their balances/allowances directly by interfacing with the blockchain, therefore finality is only achieved when the ring settlement is confirmed onchain.

### Higher Throughput & Lower Cost
An offchain token transfer takes only a minimal cost for generating the proof for updating a Merkle tree. The cost of a single onchain token transfer, however, takes roughly 20,000 gas, and checking the balance/allowance of the sender takes roughly other 5,000 gas. These costs significantly limit the possible throughput and increase the cost of rings settlement.

### Concurrent Proof Generation
If we don't do onchain transfers we don't need the proof immediately when settling rings because we can easily revert the state back by restoring the merkle tree roots. The operator can just call `commitBlock` without a proof, but the operator includes a deposit instead. The operator then needs to submit the proof within some time limit (e.g. 120 seconds) or he loses his deposit (which needs to be substantial). This allows for
- faster settlement of rings because operators don't need to wait on the proof generation before they can publish the settlements (and thus also the new merkle tree states) onchain.
- the proof generation can be parallelized. Multiple operators can generate a proof at the same time. This isn't possible otherwise because the initial state needs to be known at proof generation time.

There is **NO** risk of losing funds for users. The worst that can happen is that the state is reversed to the latest state that was successfully proven. All rings that were settled afterwards are automatically reverted by restoring the merkle roots. Blocks with deposits that were reverted need to be re-submitted and withdrawals are only allowed on finalized state.

# Design

## Token registration

Before a token can be used in the protocol it needs to be registered so a small token ID of 2 bytes can be used instead. We ensure the token is not already registered.

We further limit the token ID to just 12 bits (i.e. a maximum of 4096 tokens) to increase the performance of the circuits.

To limit abuse, an amount of LRC needs to be burned. The more tokens are registered, the higher the fee to register a token. This ensures registering a token is very cheap if the function is not abused, and if it is abused than it will get more and more expensive which will limit the use to only useful token registrations.
```
// Fee
uint public constant TOKEN_REGISTRATION_FEE_IN_LRC_BASE           = 100 ether;
uint public constant TOKEN_REGISTRATION_FEE_IN_LRC_DELTA          = 10 ether;
function getTokenRegistrationFee() public view returns (uint)
{
    // Increase the fee the more tokens are registered
    return TOKEN_REGISTRATION_FEE_IN_LRC_BASE.add(TOKEN_REGISTRATION_FEE_IN_LRC_DELTA.mul(tokens.length));
}
```
Burnrates are stored onchain in `TokenRegistry`. 3 tokens are pre-registered and have a fixed tier:
- ETH: tier 3
- WETH: tier 3
- LRC: tier 1

## Accounts merkle tree

![Accounts tree](https://i.imgur.com/0FyNcRo.png)

(burnBalance is not part anymore of the Balance leaf, please ignore this value)

I went through a lot of iterations for the merkle tree structure, currently the one shown above is used. There's a lot of ways the merkle tree can be structured (or can be even split up in multiple trees, like a separate tree for the trading history, or a separate tree for the fees). I think the one above has a good balance between complexity, proving times and user-friendliness.

- Only a single account needed for all tokens that are or will be registered
- No special handling for anything. Every actor in the loopring ecosystem has an account in the same tree.
- While trading, 3 token balances are modified for a user (tokenS, tokenB, tokenF). Because the balances are stored in their own sub-tree, only this smaller sub-tree needs to be updated 3 times. The account itself is modified only a single time (the balances merkle root is stored inside the account leaf). The same is useful for wallets, ringmatchers and operators because these also pay/receive fees in different tokens.
- The trading history tree is a sub-tree of the token balance. This may seem strange at first, but this is actually very efficient. Because the trading history is stored for tokenS, we already need to update the balance for this token, so updating the trading history only has an extra cost of updating this quite small sub-tree. The trading-history is not part of the account leaf because that way we'd only have 2^16 leafs for all tokens together.
- No need for multiple account trees to lock accounts to a single wallet. The walletID stored in the account is used for this together with dual-authoring accounts that only the owner of the wallet can create see [Wallets](#wallets) for more info).

## Account creation

Before the user can start trading he needs to create an account. An account allows a user to trade any token that is registered (or will be registered in the future). The account is added to the Accounts merkle tree.

Creating an account is a special case for depositing. When creating an account a user can immediately deposit funds for a token.

```
function createAccountAndDeposit(
    uint32 stateID,
    uint publicKeyX, // the 1st half of user's EdDSA pubkey
    uint publicKeyY, // the 2nd half of user's EdDSA pubkey
    uint24 walletID,
    uint16 tokenID,
    uint96 amount
    )
    public
    payable
    returns (uint24);
```

A walletID (3 bytes) is given that can lock the account to a specific wallet (see [here](#wallets) for more info).

> [feedback]: We may want to remove the wallet id from the account, and add an walletId field to requests (deposit, withdral) and orders. Then one account can actually use multiple wallets.

## Depositing

This is done by calling the `deposit` function on the smart contract and adding the deposit info to an onchain hash. A fee in ETH is paid for this. The fee amount can be freely set by the state owner. A fee in ETH seems to make sense because the user needs ETH to interact with the smart contract anyway.

Note that we can **directly support ETH** for trading, no need to wrap it in WETH when using offchain balances.

We also store the deposit information onchain so users can withdraw these deposited balances in withdrawal mode when they are were not yet added in the Accounts merkle tree.

See [here](#depositwithdraw-block-handling) how blocks are handled.

> [Feedback]: This fee for depositing or creating a new account should also subject to fee-burn.

## Account info updating

The depositing circuit also allows updating some information that is stored in the account by calling `depositAndUpdateAccount`. The user can choose the change his public key or change the walletID of the account.

## Withdrawing

The user lets the operator know either onchain or offchain that he wants to withdraw. The tokens can be withdrawn by anyone from the contract by calling `withdraw` after the block containing the request has been finalized (the tokens will be send to the account owner).

Burned fees are stored in the accounts of the wallet. When withdrawing the complete balance of the burned fees is also automatically withdrawn.

> Question(dongw): I don't understand this. Burn should have nothing to do with wallet.

#### Offchain withdrawal

A request for withdrawal is sent offchain to the operator. The operator should include the withdrawal in a reasonable time in a block, though no guarantees can be made to the user when it will be included. **The user can pay a fee in any token he wants to the operator.**

If walletID > 0 than the withdrawal request also needs to be signed by the wallet (so the wallet can keep track of all changes to the account). The wallet can also request a percentage of the fee paid to the operator.

> [Feedback]: I suggest that withdrawal don't need signatures from wallets.

The nonce of the account is increased after the cancel is processed.

#### Onchain withdrawal

A user calls `requestWithdraw` and the request is added to a withdraw block. See [here](#depositwithdraw-block-handling) how blocks are handled.

A maximum withdrawal fee for a state is specified when the state is created. The state owner is allowed to change the withdrawal fee in the [0, state.maxWithdrawFeeInETH] range. This is to make sure the state owner cannot change the fee to something unreasonable.

## Ring settlement

The ring settlement is just as in protocol 2 with some limitations:
- Only 2 order rings
- No P2P orders (always use fee token)
- No onchain registration of orders
- No fee waiving mechanism with negative percentages (which would pay using order fees, greatly increasing the number of constraints)

## Cancelling orders

There are many ways an order can be cancelled.

### validSince/validUntil

Orders can be short-lived and the order owner can safely keep recreating orders with new validSince/validUntil times using [Order Aliasing](#Order-Aliasing) as long as they need to be kept alive.

### Offchain cancel request

The user sends a request for cancelling an order. The operator should include the cancellation as soon as possible in a block, though no guarantees can be made to the user when it will be included. **The user can pay a fee in any token he wants to the operator.**

If walletID > 0 than the cancel request also needs to be signed by the wallet (so the wallet can keep track of all changes to the account). The wallet can also request a percentage of the fee paid to the operator.

The nonce of the account is increased after the cancel is processed.

> Question(dongw): how many orders at most can be supported by one single account?

### Updating the Account info

The account information can be updated with a new public key or a new walletID which can invalidate everything the account is used in.

### Wallet stops signing rings with the dual-author address

Only the party with the dual-author keys can actually use the order in a ring. Especially in an order-sharing setup like described [here](#Order-sharing-with-Dual-Authoring) this  would be very useful. Anybody can become a 'wallet', so big traders can use their own personal dual-author addresses and remain in complete control of their orders.

### The DEX removes the order in the order book

If the order never left the DEX and the user trusts the DEX than the order can simply be removed from the order book.

## Withdrawal mode

The operator may stop submitting new blocks at any time. When some conditions are met (TBD), all functionality for the state is halted and only withdrawing funds is possible. Anyone is able to withdraw funds from the contract by submitting an inclusion proof in the Accounts merkle tree (the funds will be send to the account owner like usually).

> [Feedback]: We need to finalize those conditions.

## Signature types

Ideally we want to only support a single signature type. Even though only a single signature type is actually used for an order, the number of constraints the prover needs to solve is the sum of all of them.

Currently this is EDDSA (7,000 constraints), which is a bit cheaper than ECDSA signatures (estimated to be ~12,000 constraints). EDDSA may have hardware wallet support (not sure), but maybe ECDSA signatures would be nicer because they are more standard.

> [Feedback]: IF ECDSA can be supported, I strongy prefer to use ECDSA instead of EDDSA even if the gas cost is higher. Using ECDSA will avoid the creation and maintaince of an extra ECDSA public/private key pair.

## ValidSince / ValidUntil

A block and its proof is always made for a fixed input. The operator cannot accurately know on what timestamp the block will be processed on the ethereum blockchain, but he needs a fixed timestamp to create a block and its proof (the chosen timestamp impacts which orders are valid and invalid).

We do however know the approximate time the block will be processed on the ethereum blockchain. Next to the data for the block the operator also includes the timestamp the block was generated for. This timestamp is checked against the timestamp onchain and if it's close enough the block is accepted:

```
uint32 public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS      = 1 minutes;
require(block.timestamp > now - TIMESTAMP_WINDOW_SIZE_IN_SECONDS &&
        block.timestamp < now + TIMESTAMP_WINDOW_SIZE_IN_SECONDS, "INVALID_TIMESTAMP");
```

## Fee burning

Fees are stored in the wallet/dual-author accounts of the wallet/ringmatcher. These accounts are special as anyone can request a withdrawal onchain. In `withdraw` we check if the account is a wallet/dual-author account to see if we need to burn part of the balance.

Once withdrawn from the merkle tree the balances are stored onchain in the Exchange contract so the BurnManager can withdraw them using `withdrawBurned`.

> [Feedback]: Is it possible that a wallet create its own account aud use it both for trading and for receiving fees in the same time? 

## Brokers

Allows a broker to sign orders for someone else.

The account system is used for this. Users can create a special account for a broker and deposit funds the broker is able to use. This is done by setting `account.publicKey` to the public key of the broker instead of the order owner. To stop the broker from being able to fill orders the balance can be withdrawn or the public key stored in the account can be changed.

## States

Block submission needs to be done sequentially so merkle trees can be updated correctly. To allow concurrent settling of orders by different independent parties we allow separate states for the merkle trees that can give contention.

Anyone can register a new state. The owner of the state can set the deposit / offchain withdrawal fees by calling `setStateFees`.
The owner of the state can also close the state at any time. The state will immediately enter withdrawal mode.

We make sure every operation signed by a user can only be used in a single state.

## Wallets

Wallets can register themselves so they can get a dedicated walletID so they can lock accounts of users to their wallet.

The steps needed by a wallet to achieve this:
- Call `registerWallet` to get a unique walletID and bind the walletID to msg.sender, which will be the owner of the wallet
- Call `createAccountAndDeposit` and specify the walletID given above as its own walletID, then set the most significant 3 bits of the accountId to 1. Only the msg.sender that registered the wallet can be used to create an account like this.
- Let users create accounts with the walletID.
- Let users create orders using these accounts and specify as dual-author address the special dual-author account created by the owner of the wallet.
- The circuit will check that the walletID in the account of the user matches the walletID of the wallet/dual-author account.

Without the special dual-author account anyone would be able to use any account, no matter the walletID specified in the account.
If the wallet doesn't need to lock the account of the user in than he can create a wallet account for walletID 0. Anyone is allowed to create dual-author/wallet accounts for walletID 0.

The wallet/dual-author account is used for multiple things:
- To make sure the ring cannot be stolen by the operator
- To make sure the order cannot be used by ringmatchers that are not allowed to use the order
- This account receives the wallet fees (and the burned fees)
- Can be used as a 'wallet authentication' account created specifically for a wallet that is used to 'unlock' the account of a user so it can be used in offchain operations (trading, offchain withdrawals, cancels).

Note that this reusing of this special account is done for efficiency reasons. The wallet account doesn't need to sign the complete ring, just the order would work just as well. But by using the account also as the dual-author account the circuit is more efficient. This does have the drawback that creating an account for dual-authoring is needed, which costs a bit of gas. If we need unlimited dual-author addresses we should decouple both so that dual-authoring doesn't need an account (by storing the public key directly in the order).

> [Feedback]: In general I don't understand the above paragraphs. It seem the dual-authroing is different form 2.0. In 2.0. each order will have a unique dual-authroring pubKey, but seems in 3.0, different orders can share the same pubKey and the wallet owns the corrsponding private key. If this is true, what if an order is NOT created by a wallet software, do we still support the 2.0-style dual authoring?
> 
> Is there a special account type called dual-authoring account, or we can use any account as a dual-authoring account? This is still confusing in the doc.
> 
> When we state "wallet/dual-author account", do we really mean "wallet (aka dual-authoring) account"?

## Ringmatchers

Ringmatchers need to create a normal account so they can pay the operator (and receive the burnrate-free margin). They also need to create a wallet/dual-author account
to receive the matching fee (because the burnrate needs to be applied on these funds when withdrawing).

## Operators

Operators are responsible for creating blocks. Blocks need to be submitted onchain and the correctness of the work in a block needs to be proven. This is done by creating a proof.

At creation time, a state specifies if anyone can become an operator for the state or not. If not, only the owner can add operators.

All operators are staked. LRC is used for this. If the operator fails to prove a block he submitted the amount staked is burned and the state is reverted to the last block that was proven. The operator is removed from the list of active operators. Anyone can call `revertBlock` when it takes the operator longer than `MAX_PROOF_GENERATION_TIME_IN_SECONDS` (currently 1 hour) to verify a block he submitted.

> [Feedback]: should we make every onchain block-submission tx check the condition for reverting blocks? This will guarantee bad blocks are reverted automatically in a timely fashion. I assume the condition checking is relative easier and will not use many gas.

Multiple operators can be active at the same time. The operator is chosen at random like this:
```
function getActiveOperatorID(uint32 stateID) public view returns (uint32)
  {
      State storage state = getState(stateID);
      require(state.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");

      // Use a previous blockhash as the source of randomness
      // Keep the operator the same for 4 blocks
      uint blockNumber = block.number - 1;
      bytes32 hash = blockhash(blockNumber - (blockNumber % 4));
      uint randomOperatorIdx = (uint(hash) % state.numActiveOperators);

      return state.activeOperators[uint32(randomOperatorIdx)];
  }
```

Every operator stakes the same amount of LRC to make the onchain logic as cheap as possible (otherwise we'd have to use weights to give operators with a larger stake more chance to be selected). An operator can register itself (by calling `registerOperator`) multiple times to increase its chances to be chosen as the active operator. The active operator can be queried by calling `getActiveOperatorID`.

An operator can choose to unregister itself at any time by calling `unregisterOperator`. To make sure the operator doesn't have any unproven blocks left an operator can only withdraw the amount he staked after a safe period of time (currently 1 day) by calling `withdrawOperatorStake`.

> [Feedback]: the amount of LRC for staking may actualy vary among operators, if we ever allow this amount to be updated by a super user. For example, if the amount was specified as 100K LRC, then one month later, we decrease it to 80K, then operators who join late will only need to stake 80K instead of 100K, and operators who have staked 100K can actualy unregistere and register again. But if we change the amount from 80K to 100K, previous operators should still be treated valid and equal.

### Restrictions

The operator needs all the order data to generate the proof. To allow orders to be matched by any criteria by a ringmatcher we need an extra mechanism so operators cannot freely match orders and/or rings if needed.

#### Restrict order matching

We use **dual-authoring** here. Orders can only be matched in rings signed by the wallet (or anyone having the necessary keys).

#### Restrict sequence of ring settlements

We need a way to limit how an operator can insert rings in a proof otherwise an operator can settle rings in any order messing up the real sequence the settlements happened in the DEX. We also need to ensure that the ring can only be used a single time by the operator.

We use a **nonce** here. The nonce of the ringmatcher account paying the operator is used. The ring signed by the ringmatcher contains a nonce. The nonce in the next ring that is settled for this ringmatcher needs to be the nonce of the previous ring that was settled incremented by 1.  A ringmatcher can have multiple accounts to have more control how rings can be processed by the operator (e.g. an account per trading pair).

Note that doing an offchain withdraw also increments the nonce value. A ringmatcher thus may want to limit himself to onchain withdrawals so the nonce value of the account remains the same.

#### Only allow cancels/offchain withdrawal requests to be used once by an operator

The **nonce** of the account is increased by 1 for these operations.

### Fee

The fee paid to the operator is completely independent of the fee paid by the orders. Just like in protocol 2 the ringmatchers pays a fee in ETH to the ethereum miners, the ringmatcher now pays a fee to the operator. **Any token can be used to pay the fee.**

## Circuit permutations

A circuit always does the same. There's no way to do dynamic loops. Let's take the rings settlement circuit as an example:
- The circuit always settles a fixed number of rings
- The rings always contain the predetermined number of orders

Currently there are 5 circuits:
- Trade
- Deposit
- Offchain withdraw
- Onchain withdraw
- Cancel

## Delayed proof submission

Creating a proof can take a long time. If the proof needs to be available at the same time the state is updated onchain we limit the maximum throughput of the system by the proof generation time. But we don't need the proof immediately. This allows different operators to work together much more efficiently:
- The selected operator that is allowed to commit work can change quickly. If the operator wants to do work than he can quickly commit that work onchain without needing the time to also generate the proof immediately.
- Different operators can be busy generating proofs for different work

We use a simple commit and proof scheme. The operator commits all necessary data onchain and updates the state. The other operators now have all the data they need to start working on their own block.

Proofs do not need to be submitted in order. The proof can be submitted anytime from the start the block was committed until the maximum proof generation time has passed.

## Order Aliasing

Every account has a trading history tree with 2^16 leafs for every token. Which leaf is used for storing the trading history for an order is completely left up to the user, and we call this the **orderID**. While this was done for performance reasons (so we don't have to have a trading history tree with a large depth using the order hash as an address) this does open up some interesting possibilities:

### Safely updating the validUntil time of an order

For safety the order owner can limit the time an order is valid, and increase the time whenever he wants safely by creating a new order with a new validUntil value, without having to worry if both orders can be filled separately. This is done just by letting both orders use the same orderID.

This especially a problem because the operator can set the timestamp that is tested onchain within a certain window (see [here](#validSince--validUntil)). So even when the validSince/validUntil doesn't overlap it could still be possible for an operator to fill multiple orders. The order owner also doesn't know how much the first order is going to be filled until it is invalid. Until then, he cannot create the new order if he doesn't want to buy/sell more than he actually wants. Order Aliasing fixes this problem.

### The possibility for some simple filling logic between orders

A user could create an order selling X tokenZ for either N tokenA or M tokenB (or even more tokens) while using the same orderID. The user is guaranteed never to spend more than X tokenZ, but will have bought [0, N] tokenA and/or [0, M] tokenA.

A realistic use case would be for selling some token for one of the available stable coins. Or selling some token for ETH and WETH. In these casse the user doesn't really care which token specifically he buys, but increases his chance of finding a matching order.


## Deposit/Withdraw block handling

Onchain deposit/withdrawal requests are queued in blocks onchain.
- The amount of blocks that can be created in a certain timespan is limited. This is to make sure the operator isn't overwhelmed by these requests and can actually process them. A block can be created every `MIN_TIME_OPEN_BLOCK`.
- A block can only remain open for only a limited time, this is to ensure users don't have to wait an unreasonable amount of time until their request is processed. A block is open when there is at least one request in a block. A block is automatically closed after `MAX_TIME_OPEN_BLOCK` when not full. (Of course, for an operator full blocks are preferred because the circuit is created for a fixed number of requests so the cost to process a block is approximately the same, no matter the number of requests that are actually done in the block.)
- A block is committable after `MIN_TIME_CLOSED_BLOCK_UNTIL_COMMITTABLE`. This is a short time after the block is closed so that all parties know how the state will be changed.
- A block needs to be processed after `MAX_TIME_CLOSED_BLOCK_UNTIL_FORCED`. No other work can be committed until the forced block is committed by the operator.

Current values:
```
uint16 public constant NUM_DEPOSITS_IN_BLOCK                 = 8;
uint16 public constant NUM_WITHDRAWALS_IN_BLOCK              = 8;

uint32 public constant MIN_TIME_BLOCK_OPEN                          = 1 minutes;
uint32 public constant MAX_TIME_BLOCK_OPEN                          = 15 minutes;
uint32 public constant MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE      = 2 minutes;
uint32 public constant MAX_TIME_BLOCK_CLOSED_UNTIL_FORCED           = 15 minutes;
```

Once the block the deposit/withdraw block was committed in is finalized anyone can call `withdrawBlockFee` to send the fee earned to the operator that committed the block.

## Onchain data

**Data availability is ensured for ALL merkle trees for ALL States**.

#### Ring settlement data
For every Ring (2 orders):
```
bs.addNumber(ring.minerAccountID, 3);
bs.addNumber(ring.tokenID, 2);
bs.addBN(new BN(ring.fee, 10), 12);
bs.addBN(new BN(ring.margin, 10), 12);
let index = 0;
for (const order of [orderA, orderB]) {
  bs.addNumber(order.accountID, 3);
  bs.addNumber(order.dualAuthAccountID, 3);
  bs.addNumber(order.tokenS, 2);
  bs.addNumber(order.tokenF, 2);
  bs.addNumber(order.orderID, 2);
  bs.addBN(new BN(index === 0 ? ring.fillS_A : ring.fillS_B, 10), 12);
  bs.addBN(new BN(index === 0 ? ring.fillF_A : ring.fillF_B, 10), 12);
  bs.addNumber(order.walletSplitPercentage, 1);
  bs.addNumber(order.waiveFeePercentage, 1);
  index++;
}
```
=> **105 bytes/ring**
=> Calldata cost: 105 * 68 = **7140 gas/ring**

We can save some more bytes (e.g. on the large values of the margin and the fees, these can be much more efficiently packed) so we can probably get this down to ~80 bytes/ring.

#### Order cancellation data
```
bs.addNumber(cancel.accountID, 3);
bs.addNumber(cancel.orderTokenID, 2);
bs.addNumber(cancel.orderID, 2);
bs.addNumber(cancel.dualAuthAccountID, 3);
bs.addNumber(cancel.feeTokenID, 2);
bs.addBN(cancel.fee, 12);
bs.addNumber(cancel.walletSplitPercentage, 1);
```
- => **25 bytes/cancel**
- => Calldata cost: 25 * 68 = **1700 gas/cancel**

This is already quite cheap, but can be greatly improved by packing the fee value better.

#### Withdrawal data
```
bs.addNumber(withdrawal.accountID, 3);
bs.addNumber(withdrawal.tokenID, 2);
bs.addBN(web3.utils.toBN(withdrawal.amountWithdrawn), 12);
bs.addNumber(withdrawal.burnPercentage, 1);
if (!onchain) {
  bs.addNumber(withdrawal.dualAuthAccountID, 3);
  bs.addNumber(withdrawal.feeTokenID, 2);
  bs.addBN(web3.utils.toBN(withdrawal.fee), 12);
  bs.addNumber(withdrawal.walletSplitPercentage, 1);
}
```
- => Onchain: **18 bytes/withdrawal**
- => Onchain withdrawal calldata cost: 18 * 68 = **1224 gas/onchain withdrawal**
- => offchain: **36 bytes/withdrawal**
- => Offchain withdrawal calldata cost: 36 * 68 = **2448 gas/offchain withdrawal**


The onchain withdrawal calldata also needs to be stored onchain so the data can be used when actually withdrawing the tokens when allowed (storing 32 bytes of data costs 20,000 gas):
- => Data storage cost: (18 / 32) * 20,000 = **11250 gas/withdrawal**

## Performance (ring settlements)

### Onchain data

Maximum gas consumption in an Ethereum block: 8,000,000 gas
- Verifying a proof + some state updates/querying: 600,000 gas
- => (8,000,000 - 600,000) / 7,140 = 1,036 rings/block = ~70 rings/second

### Constraints

We can only efficiently prove circuits with a maximum of 256,000,000 constraints onchain.
- 256,000,000 / ~650,000 = ~400 rings

So in a block we are currently limited by the number of constraints used in the circuit. Verifying a proof costs _only_ ~600,000 gas so this is actually not that bad

### Proof generation

Haven't done much testing for this. From [Matter Labs](https://medium.com/matter-labs/introducing-matter-testnet-502fab5a6f17):
> [about circuits with 256 million constraints] "the computation took 20 minutes on a 72-core AWS server".

> At the target latency of 5 min at 100 TPS we estimate the offchain part to be approximately 0.001 USD. This estimate is very conservative.

Ring settlements are about ~5x more expensive than the simple token transfers they are talking about, but this will still be pretty cheap.

# Case studies

## DEX with CEX-like experience

### Setting up the DEX

The DEX can use an existing state so the DEX doesn't need to operate its own operators, or the DEX can create a new state and can limit the state to operators the DEX operators itself if that's what the DEX wants. In any case, the steps needed for the setup are the same

- (The DEX calls `createNewState` to create the new state)
- The DEX calls `registerWallet` to get a walletID so it can lock the account of its users to its DEX.
- The DEX also calls `createAccountAndDeposit` to create a dual-author account that can be used to sign off on rings using these accounts. This account will be also be used to receive fees.
- The DEX calls `createAccountAndDeposit` to create a ringmatcher account to match rings and pay fees to the operator.

### Setting up a user

The user
- creates an account while depositing a token using `createAccountAndDeposit` on the smart contract

### Trading

Users create orders using accounts created with the walletID of the DEX. Orders are added to the order books of the DEX.

The DEX matches the order with another order, signs the ring using the ringmatcher private key and the dual-author keys of the orders. The order gets completely filled in the ring:
- The GUI of the DEX can be updated immediately with the state after the ring settlement. The order can be shown as filled, but not yet verified.
- The DEX sends it to the operators of the state. Because these rings need to be settled in a reasonable time the operator needs to call `commitBlock` as soon as possible after receiving rings.
- The operator generates the proof and calls `proofBlock` within the maximum time allowed

The DEX could now show an extra 'Verified" symbol for the order fill.

An order can be in the following states:
- **Unmatched** in an orderbook
- **Matched** by the DEX
- **Commited** in a block sent in `commitBlock`
- **Verified** in a block by a proof in `verifyBlock`
- **Finalized** when the block it was in is finalized (so all blocks before it are also verified)

Only when the block is finalized is the filling of the order irreversible.

# Deposit and Withdrawal process

The first thing a user needs to do is create an account. The user has the option to deposit tokens directly to this account. These will be used as his offchain balance available in the newly created account. The user also has the option to not send any funds, this is useful when the user just needs an account to receive tokens or he wants to use the account with onchain balances.

`deposit` is called on the contract. Here a new account is created onchain (the onchain account information does not contain any balance information because the balance will only be used and updated in the merkle tree) and the necessary data is hashed together that needs to be used for creating the account in the Accounts merkle tree in the circuit. The amount of tokens the user deposits to the contract will be stored in the leaf of the Accounts merkle tree with address `account ID` (together with the rest of the account information).

The Accounts merkle tree has not yet been updated. This needs to be done by the operator in the circuit and can never be done by a user. The smart contract decides when the operator needs to add the account to the merkle tree in the circuit so the account can actually be used. As long as the account is not added to the merkle tree the account cannot be used.

The operator can stop working before this is done however. That's why the amount deposited should be stored somewhere onchain so that the user can withdraw these funds in withdrawal mode.

But the operator wants to earn fees so he creates a block that adds the account to the merkle tree when it is expected by the smart contract. After the account is added in the circuit, it can immediately be used.

The account balance is updated between trades as you'd expect.

The user then wants to withdraw (a part of) the balance. He can let the operator know onchain, or he can just send a request offchain. The only difference is that when the request is made offchain the operator can choose when to do the withdrawal so there is no guarantee when it will be done. In any case, there will be delay between the request for withdrawal and when the operator includes the withdrawal in a block. In this period the operator is free to keep using the account to settle rings.

After some time the operator includes the withdrawal in a block. Two things are done when this happens:
- The balance in the Accounts merkle tree is subtracted with the amount withdrawn in the circuit (if possible of course, otherwise nothing is withdrawn)
- The smart contract adds the amount that is withdrawn to a list stored onchain for that block specifically.

The withdrawn amount is stored in a list because the user is still not able to actually withdraw it yet! The user is only able to withdraw it when the block is finalized, which means that state is completely irreversible.

This mechanism is needed to support delayed proof submission. If the proof would always need to be given immediately than we are always certain the new state is valid and the amount withdrawn is correct. But with delayed proof submission we are only certain the block is correct and irreversible when all blocks before it and including the block containing the withdrawal are proven.

Once the operators have submitted all the proofs necessary for the block containing the withdrawal to be finalized, the user is finally able to call `withdraw` onchain with the necessary information when the withdrawal was done to get the tokens out of the smart contract.

Let's now look at the case where the withdrawal request was done by an operator, but the block containing the withdrawal needs to be reverted for some reason (e.g. the operator submits an invalid proof for the block). Two things happen automatically by the revert:
- The merkle tree root is restored as it was before the withdrawal. The balance is restored.
- The list of withdrawals we stored onchain for the reverted block are thrown away when reverting. A user was never able to withdraw from these in `withdraw` because the block associated with the witdrawn list was never marked as finalized.

## Order sharing with Dual Authoring

Very similar as in protocol 2, but used a bit differently.

Automatically sharing orders between DEXs can be problematic, mainly because of collisions. For example, DEX B could decide it wants to use an order of DEX A and creates a ring and sends it to the operator. But at the same time, DEX C could have also decided to use the same order in a different ring. In the best case, both rings can be settled. But it's also possible only one of the rings can be settled because the shared order cannot be filled for the fill amount specified in the second ring. Or because the balance of the order owners isn't sufficient anymore. This uncertainty makes it so that a DEX needs to wait longer to show the result of a trade to the user. It's also hard for a DEX to track the state of a shared order and of the balances of its users if they can be modified at any time without is knowledge.

A solution for this could be dual authoring. But, we don't share the dual author keys with anyone. When a ringmatcher wants to create a ring using orders of wallet A and wallet B then the ring needs to be signed by wallet A **and** wallet B **independently**. This negotiation would be completely offchain.

The protocol would be something like this. DEX A signs a ring using orders of DEX A and DEX B and sends it to DEX B. DEX B can now decide if he wants to share the order with DEX A or not in the given ring. If not, DEX B simply sends a message back that there is no deal. If DEX B does want to share the order, he can sign the ring as well. The ring is now signed by DEX A and DEX B (the DEXs of the orders in the ring) and the ring can be sent to the operator for settlement. DEX B now sends the doubly signed ring back to DEX A so the DEX can be sure the ring will be settled (or DEX A could just monitor the rings submitted to the operators).

This process should be very fast. The delay between the initial request and knowing whether the ring can be settled should take at most seconds. DEXs also know exactly the state each order is in or is going to be in because every shared order still needs to pass through the DEX it is from.

The protocol could allow the payment of an additional fee for the use of the order. How much fee is paid for the use of the order is completely left up to the DEXs/Wallets/Ringmatchers. If DEX A has an order, and DEX B **and** DEX C wants to use it, then DEX A can choose the DEX that offers the most fees for the order.

A scenario where this would be very helpful is for a service that offers liquidity from some place (e.g. a bot for a CEX). This service would offer orders to multiple DEXs and can decide on any criteria how it wants to share its orders.

![Order sharing](https://i.imgur.com/Lm5yyto.png)

- **Red arrows**: order sharing by negotiation (needs to be online to share orders)
- **Black arrows**: order sharing by sharing the dual author key (does not need to be online to share orders)

Simple wallets probably don't want to pay for the infrastructure to sign rings all the time for sharing their orders. So these will still share the dual author keys. But to prevent collisions etc... they should only share the keys with a single ringmatcher/DEX.

This order sharing is only possible when the orders use the same merkle trees and operators, so this is not possible for independent DEXs. But it's a big advantage for everyone to use the same merkle trees, even though they have less control over the operator.

Recap:
- DEX/Wallet/Ringmatcher can keep track of his orders and the balances of his users because every order that is used needs to pass through him
- Orders are cancelled by not signing any rings anymore with the order, which only the wallet can do
- No collisions
- Fine-grained order sharing with the possibility of a fee
- Same order can be shared multiple times in multiple rings with multiple parties
