## Table of Contents

- [Loopring 3.6](#loopring-3)
  - [Introduction](#introduction)
  - [Trading with Off-chain Balances](#trading-with-off-chain-balances)
    - [Apparent Immediate Finality](#apparent-immediate-finality)
    - [Higher Throughput &amp; Lower Cost](#higher-throughput--lower-cost)
- [Design](#design)
  - [Merkle Tree](#merkle-tree)
  - [Blocks](#blocks)
  - [Operators](#operators)
  - [Exchanges](#exchanges)
    - [Deposit Contract](#deposit-contract)
    - [Exchange Creation](#exchange-creation)
    - [Exchange Staking](#exchange-staking)
    - [Exchange Shutdown](#exchange-shutdown)
    - [Token Registration](#token-registration)
  - [zkRollup Transactions](#zkRollup-Transactions)
    - [Spot trade](#spot-trade)
      - [Fee Model](#fee-model)
      - [AMM](#AMM)
      - [Canceling Orders](#canceling-orders)
      - [Storage](#storage)
    - [Transfer](#transfer)
    - [Deposit](#deposit)
    - [Withdraw](#withdraw)
    - [Account Update](#account-update)
    - [AMM Update](#AMM-update)
    - [Signature Verification](#signature-verification)
    - [No-op](#no-op)
    - [Block](#block)
  - [Account Creation](#account-creation)
  - [Signatures](#signatures)
  - [Forced Request Handling](#forced-request-handling)
  - [Withdrawal Mode](#withdrawal-mode)
  - [Conditional Transactions](#conditional-transactions)
  - [Agents](#agents)
  - [Brokers](#brokers)
  - [Timestamp in Circuits](#timestamp-in-circuits)
  - [Protocol Fee](#protocol-fee)
  - [Throughput](#throughput-ring-settlements)
    - [On-chain Data-availability Limit](#on-chain-data-availability-limit)
    - [Constraints Limit](#constraints-limit)
    - [Results](#results)
    - [Proof Generation Cost](#proof-generation-cost)
- [Case Studies](#case-studies)
  - [DEX with CEX-like Experience](#dex-with-cex-like-experience)
    - [Setting up the exchange](#setting-up-the-exchange)
    - [Trading](#trading)

# Loopring 3

Loopring 3 is a zkRollup Exchange and Payment Protocol. The most recent version is Loopring 3.6.

# Introduction

In Loopring Protocol 3, we want to improve the throughput of the protocol significantly. We do this by using zkSNARKs -- as much work as possible is done off-chain, and we only verify the work on-chain.

For the highest throughput, we only support off-chain balances. These are balances that are stored in Merkle trees. Users can deposit and withdraw tokens to our smart contracts, and their balance will be updated in the Merkle trees. This way, we can transfer tokens between users just by updating the Merkle tree off-chain, there is no need for expensive token transfers on-chain.

Note that there is never any risk of losing funds when depositing to the smart contract. Both options are trust-less and secure.

On-chain data availability for the Merkle tree ensures anyone can recreate the Merkle tree just using the data published on-chain.

# Trading with Off-chain Balances

## Apparent Immediate Finality

Off-chain balances are guaranteed to be available for a short time in the future (until a withdrawal), which allows for a CEX like experience. A DEX can settle a ring off-chain and immediately show the final results to the user without waiting for the on-chain settlement confirmation. Using on-chain balances, users can modify their balances/allowances directly by interfacing with the blockchain. Therefore finality is only achieved when the ring settlement is confirmed on-chain.

## Higher Throughput & Lower Cost

An off-chain token transfer takes only a minimal cost for generating the proof for updating a Merkle tree. However, the cost of a single on-chain token transfer takes roughly 20,000 gas, and checking the balance/allowance of the sender takes roughly another 5,000 gas. These costs significantly limit the possible throughput and increase the cost of rings settlement.

# Design

# Merkle Tree

A Merkle tree is used to store all the permanent data needed in the circuits.

![Merkle Tree](https://i.imgur.com/dNvIuso.png)

There are many ways the Merkle tree can be structured (or can be even split up in multiple trees, like a separate tree for the trading history, or a separate tree for the fees). The Merkle tree above has the right balance between complexity, proving times, and user-friendliness.

- Only a single account needed for all tokens that are or will be registered
- No special handling for anything. Every actor in the Loopring ecosystem has an account in the same tree.
- A single nonce for every account (instead of e.g., a nonce for every token a user owns) allows off-chain requests to be ordered on the account level, which users will expect.
- While trading, two token balances are modified for a user (tokenS, tokenB). Because the balances are stored in their own sub-trees, only this smaller sub-tree needs to be updated two times. The account itself is modified only a single time (the balances Merkle root is stored inside the account leaf). The same is useful for operators because they also pay/receive fees in different tokens.
- The storage tree is a sub-tree of the token balance, which may seem strange at first, but is very efficient. Because the storage is stored for tokenS, we already need to update the balance for this token, so updating the storage only has an extra cost of updating this small sub-tree. The storage is not part of the account leaf because that way, we would only have 2^14 leaves for all tokens together. Note that account owners can create [a lot more orders](#storage) for each token than the 2^14 slots available in this tree!

The first account with accountID 0 is used to store the protocol fees until they are withdrawn to layer 1.

# Blocks

Work is batched together in a block (which is not to be confused with an Ethereum block). All data necessary for all types of work is stored in the Merkle tree. A block changes the Merkle tree from the existing state to the new state by doing the state changes required in all the work in the block. These state changes can be verified on-chain by generating a ZK proof using a circuit. Only the Merkle root is stored on-chain. The actor responsible for creating and committing blocks is called the operator.

# Operators

The operator is responsible for creating, proving, and submitting blocks. Blocks will be submitted on-chain, and the correctness of the work in a block needs to be proven with a ZKP proof.

The operator can be a simple Ethereum address or a complex contract that allows multiple operators to work together to submit and prove blocks. It is up to the exchange for how this is set up.

The operator contract can also be used to enforce an off-chain data-availability system. A simple scheme could be that multiple parties need to sign off on a block before it can be committed. This can be checked in the operator contract. As long as one member is trustworthy and actually shares the data, then data-availability is ensured.

The operator creates a block and submits it on-chain by calling `submitBlocks`. Multiple blocks can be submitted at the same time. All blocks will be verified immediately. If possible, batch verification is used to verify multiple blocks of the same type.

An operator can only submit new blocks when the exchange owner has `minExchangeStakeWithDataAvailability`LRC staked.

## Replay protection

All zkRollup transactions increase the **nonce** of the account which authorized the transaction, except:

- Deposits
- Forced withdrawals
- Spot trades
- Transfers

The first two are authorized on-chain, and thus the replay protection is handled on that level. Spot trades and transfers can be processed more flexibly and protected against replay using the Merkle tree's storage sub-tree.

# Exchanges

Block submission needs to be done sequentially so the Merkle tree can be updated from a known old state to a new state. To allow concurrent settling of orders by different independent parties, we allow the creation of stand-alone exchange contracts. Every exchange operates entirely independently.

Note that user accounts and orders cannot be shared over different exchanges. Exchanges can decide to use the same Exchange contract to share orders and users' accounts if they desire.

The Loopring contract is the creator of all exchanges built on top of the Loopring protocol. This contract contains data and functionality shared over all exchanges and enforces some minimal exchange settings, such as the forced withdrawal fee.

## Deposit Contract

The deposit contract is the contract that stores all the user funds and contains all the logic to transfer funds from and to a particular exchange. We now allow exchanges to write their own custom deposit contract, which provides them the flexibility to decide how exactly this is handled. In the most basic case, the deposit contract simply stores all user funds directly in the deposit contract and only supports transferring ETH and ERC20 tokens. This is the most secure way to handle user funds, but it is inefficient because all the value locked up into the exchange is unused.

Productive use of the funds would be to store the funds in a DeFi dApp that allows borrowing and lending, for example. The exchange would earn interest on this, which it could pass on to users directly (users can accrue interest directly on layer 2) or even indirectly by having lower fees. However, this is likely never to be 100% safe, so some extra precautions should be built into the contract to make sure users can withdraw all their funds. This is a delicate balance, and there is no single best solution, so we allow exchanges to decide how they want to handle this.

Another interesting possibility of the deposit contract is to support more token standards. All interactions with token contracts are done in the deposit contract, so that is the only place that knows how to interact with a specific token. No changes are necessary for the exchange contract implementation.

It is also possible to use the token addresses as seen by the exchange as a key value. Because the deposit contract handles all interaction with the token contract, the token address value seen by the exchange may differ from the actual token address. The deposit contract can simply map to the actual token address just before interacting with the token contract. This allows, for example, the same token to be registered multiple times, but the deposit contract can store the funds in different ways. Alternatively, it can even be used to support trading multiple tranches of a single security token.

## Exchange Creation

Anyone can create a new exchange by calling `forgeExchange` on the ProtocolRegistry contract. A small amount of LRC may need to be burned to create a new exchange.

An Exchange has an owner. The owner is the only one who can submit blocks (more commonly called the operator in this role), but the owner call functions related to the more business side of things like registering tokens.

## Exchange Staking

An exchange stakes LRC. Anyone can add to the stake of a particular exchange by calling `depositExchangeStake`; withdrawing the stake however, is only allowed when the exchange is completely [shut down](#exchange-shutdown).

The stake ensures that the exchange behaves correctly. This is done by only allowing the stake to be withdrawn when the exchange is shut down by automatically returning all its users' funds.

Exchanges with a large stake have a lot to lose by not playing by the rules and have nothing to gain because the operator/owner can never steal funds for itself.

## Protocol Fee Staking

The exchange owner can stake LRC to lower the [protocol fee](#trading-protocol-fee). Anyone can add to the stake of a particular exchange by calling `depositProtocolFeeStake`, withdrawing the stake can be done using `withdrawProtocolFeeStake`.

Note that the amount staked this way only counts for 50% to reduce the protocol fees because of the extra flexibility compared to the exchange stake. The surplus amount of LRC staked in exchange staking (i.e., everything above the minimum amount required to submit new blocks) is counted for the complete 100%. This is to incentivize exchange staking, which gives more guarantees to users.

The protocol fees can be linearly reduced from `maxProtocolTakerFeeBips` to `minProtocolTakerFeeBips` by staking `targetProtocolTakerFeeStake`LRC, and from `maxProtocolMakerFeeBips` to `minProtocolMakerFeeBips` by staking `targetProtocolMakerFeeStake`LRC.

## Exchange Shutdown

The exchange owner can choose to shut down the exchange at any time by calling `shutdown`. However, an exchange's stake can only be withdrawn using `withdrawExchangeStake` when the exchange was shut down and did not enter withdrawal mode for `MIN_TIME_IN_SHUTDOWN` seconds. This ensures users are notified well in advance and can still withdraw their funds efficiently and in a user-friendly way with the operator's help.

## Token Registration

Before a token can be used in the exchange, it needs to be registered, so a small token ID of 2 bytes can be used instead. Only the exchange owner can register tokens by calling `registerToken`. We ensure a token can only be registered once. ETH and LRC are registered when the exchange is created.

We limit the token ID to just 16 bits (i.e., a maximum of ETH + 65535 tokens) to increase the circuits' performance.

# zkRollup Transactions

A single circuit was created that can handle all the different zkRollup transactions we support:

- Spot trade
- Transfer
- Deposit
- Withdraw
- Update account
- Update AMM
- No-op

We support a couple of different block sizes for the circuit to reduce the proving time without padding too many no-op works (or long delays until the block can be completely filled). We also support block versions so that we can upgrade the circuits.

## Spot trade

Spot trades allow trading to happen between two orders. Orders and order-matching are completely off-chain, only trade settlements are included in a block for verification.

**Partial order filling** is fully supported. How much an order is filled is [stored in the Merkle tree](#storage). No need for users to re-sign anything if the order was not filled completely in a single ring, a user only needs to sign his order a single time. The order can be included in as many rings as necessary until it is completely filled.

```
Order {
  exchange (160bit)
  storageID (32bit)
  accountID (32bit)
  tokenS (16bit)
  tokenB (16bit)
  amountS (96bit)
  amountB (96bit)
  validUntil (32bit)
  maxFeeBips (6bit)
  fillAmountBorS (1bit)
  taker (160bit)
}
```

This data is hashed using Poseidon/t12f6p53 in the sequence given above. The hash is signed by the order Owner using the private key associated with the public key stored in `account[accountID]`.

```
SpotTrade {
  Order orderA
  Order orderB
  orderA_fillS （24 bits, 19 bits for the mantissa part and 5 for the exponent part)
  orderB_fillS （24 bits, 19 bits for the mantissa part and 5 for the exponent part)
  orderA_feeBips (6bit)
  orderB_feeBips (6bit)
  orderA_amm (1bit)
  orderB_amm (1bit)
}
```

An operator can decide how a trade is settled, as long as all requirements specified in the orders are fulfilled. An operator can lower the fee of an order. This can be decided freely by the operator.

The `taker` parameter can be used to limit who can fill the order. If this parameter is left to `0`, the order can be filled by anyone.

The `fillAmountBorS` parameter can be used to decide which amount is the limiting factor when filling the order. If `fillAmountBorS` is set to true, `amountB` is used as the limiting amount, and the total amount of tokens sold can be less than `amountS`. If `fillAmountBorS` is set to false, `amountS` is used as the limiting amount, and the total amount of tokens bought can exceed `amountB`.

### Data-availability

```
- For both Orders:
    - Account ID: 4 bytes
    - Storage ID: 4 bytes
    - TokenS: 2 bytes
    - FillS: 3 bytes （24 bits, 19 bits for the mantissa part and 5 for the exponent part)
    - Order data (fillAmountBorS,feeBips): 1 byte
```

- => **28 bytes/ring**
- => Calldata cost: 28 \* 16 = **448 gas/ring**

### Fee Model

#### Trading Protocol Fee

This fee is proportionally applied on every token transfer part of the trade. The protocol fee can be lowered by staking LRC. A different protocol fee can be used for maker orders and taker orders.
A protocol fee value is stored in a single byte in `bips/10`. This allows us to set the protocol fee up to `0.255%` in steps of `0.001%` (`0.1 bips`).

##### Different treatment of maker and taker orders

The operator chooses which order is the maker and which order is the taker.
The first order in the ring is always the taker order, and the second order is always the maker order.

##### Fee payments

They are paid in the tokenB of the order. These are not taxed or do not have any other disadvantages. The order owner pays the fee to the operator respecting `feeBips`. These values are calculated on the full amount bought, and the protocol fee does not change this in any way.

The maximum value of `feeBips` is `0.63%` in steps of `0.01%` (`1 bips`).

##### Buy/Sell orders

Users can decide if they want to buy a fixed number of tokens (a buy order) if they want to sell a fixed number of tokens (a sell order). A buy order contains the maximum price the user wants to spend (by increasing amountS), a sell order contains the minimum price the users wants to get (by decreasing amountB). This allows us to do market orders.

##### Operators pays all actual costs for a trade

The operator is responsible for paying the protocol fee. By doing this, we decouple the protocol fee from the fee paid by the order owners. This is useful because the fee paid by the order can be lower than the protocol fee. Otherwise, this could give issues when the protocol fee changes or when the order is used as maker/taker, and different protocol fees apply.

Note that the operator normally receives fees from both orders, which he can use to pay the protocol fees.

Nevertheless, if the operator pays the protocol fee, why have different protocol fee rates? One could argue that a 0.05% taker fee and a 0.01% maker fee is the same as a fixed 0.03% rate because the same entity pays the fee. That is true, but in general, the operator will get a larger fee for the taker order than for the maker order so he will receive more tokens in `takerOrder.amountB` than in `makerOrder.amountB`. By having different rates, it is more likely that the operator can pay the complete protocol fee just by using the tokens he receives.

### AMM

It is possible to enable Automated Market-Maker (AMM) functionality on an account. This is done by setting the AMM token weights of at least two tokens to non-zero (using [AMM Update](#AMM-Update) transactions). Once that is the case, the operator can create any orders between those tokens, without any signature or other explicit approval of the account owner, as long as the price for the order is equal or better (from the AMM's point of view) than the price required by the AMM price curve. From the protocol's point of view, AMM swaps are the same as trades between different orders, but instead of approved with a signature from the account owner, it is approved by the curve set by the account owner. The fee paid by the AMM account for the trade to the operator is enforced to be 0.

The curve enforced in the protocol is the balancer/bancorV2 curve `x^a*y^b = k` and is defined as follows in the protocol:

```
const calcOutGivenIn = (
  balanceIn: number,
  weightIn: number,
  balanceOut: number,
  weightOut: number,
  amountIn: number,
  feeBips: number
  ) => {
    const weightRatio = weightIn / weightOut;
    const fee = amountIn * feeBips / 10000;
    const y = balanceIn / (balanceIn + (amountIn - fee));
    const p = pow(y, weightRatio);
    return balanceOut * p;
}
```

Thus, the formula depends on the following parameters:

- The current balances of the two tokens being traded in the AMM account
- The weights set for the two tokens being traded in the AMM account
- The required fee for the AMM account
- The amount being traded

The power operation cannot be efficiently implemented inside circuits (or solidity), and so we use an [approximation](https://docs.balancer.finance/protocol/index/approxing) similarly to the one used by Balancer. As an additional safety check against potential rounding errors, extra checks are added so that the price after a trade can never be decreased.

### Canceling Orders

There are many ways an order can be canceled.

#### Limit Validity in Time

Orders can be short-lived, and the order owner can safely keep recreating orders with new `validUntil` times using [Order Aliasing](#Order-Aliasing) as long as they need to be kept alive.

#### Updating the Account Info

The account information can be updated with a new EdDSA public key that invalidates all orders and transactions signed with the previous EdDSA key pair.

#### Creating an order with a larger storageID in the same storage slot

If an order with a larger storageID is used in a ring settlement at the same storage slot as a previous order, the previous order is automatically canceled. Please read [Storage](#storage) to learn more about how the trading history is stored.

#### The DEX removes the order in the order book

If the order never left the DEX and the user trusts the DEX, the order can simply be removed from the order book.

### Storage

Every account has a storage tree with 2^14 leaves **for every token**. Which leaf is used for storing e.g., the trading history for an order is completely left up to the user, and we call this the **storageID**. The storageID is stored in a 32-bit value and works as a 2D nonce. We allow the user to overwrite the existing storage stored at `storageID % 2^14` if `order.storageID > storage.storageID`. If `order.storageID < storage.storageID` the order is automatically canceled. If `order.storageID == storage.storageID` we use the data stored in the leaf. This allows the account to create 2^32 unique orders for every token, and the only limitation is that only 2^14 of these orders selling a certain token can be active at the same time.

While this was done for performance reasons (so we do not have to have a storage tree with a large depth using the order hash as an address), this does open up some interesting possibilities.

#### Order Aliasing

The account owner can choose to reuse the same storageID in multiple orders. We call this Order Aliasing.

#### Safely updating the validUntil time of an order

For safety, the order owner can limit the time an order is valid, and increase the time whenever he wants safely by creating a new order with a new validUntil value without worrying if both orders can be filled separately. This is done just by letting both orders use the same storageID.

This is especially a problem because [the operator can set the timestamp](#Timestamp-in-Circuits) that is tested on-chain within a certain window. Even when the validUntil time does not overlap, it could still be possible for an operator to fill multiple orders. The order owner also does not know how much the first order will be filled until it is invalid. Until then, he cannot create a new order if he does not want to buy/sell more than he wants. Order Aliasing fixes this problem without calculating multiple hashes (e.g., order hash with time information and without).

#### The possibility for some simple filling logic between orders

A user could create an order selling X tokenZ for either N tokenA or M tokenB (or even more tokens) while using the same storageID. The user is guaranteed never to spend more than X tokenZ, but will have bought [0, N] tokenA and/or [0, M] tokenA.

A practical use case would be selling some token for one of the available stablecoins, or selling some token for ETH and WETH. In these cases, the user does not care which specific token he buys, but he increases his chance of finding a matching order.

## Transfer

Transfers can be used to transfer tokens (including ETH) between two accounts. A fee can be paid to the operator in any token.

```
Transfer {
  exchange (160bit)
  fromAccountID (32bit)
  toAccountID (32bit)
  tokenID (16bit)
  amount (96bit)
  feeTokenID (16bit)
  fee (96bit)
  to (160bit)
  dualAuthorX (254bit)
  dualAuthorY (254bit)
  validUntil (32bit)
  storageID (32bit)
}
```

This data is hashed using Poseidon/t13f6p53 in the sequence given above. The hash is signed by the account owner of `fromAccountID` using the private key associated with the public key stored in `account[fromAccountID]`.

A transfer is done to the specified `to` address. `toAccountID` can be left to 0 to allow the operator to decide which account should receive the funds. This allows the operator to create a new account for `to` if needed.

It is also possible to sign a transfer to an unspecified `to` address. This is done by setting `to` and `toAccountID` to 0, and filling an EdDSA public keypair in `dualAuthorX` and `dualAuthorY`. This is the key pair that needs to be used to sign the transfer again, but this time with `to` and `toAccountID` specified. The private key can be shared with all potential recipients using some off-chain mechanism (e.g., a QR code). Only people that have access to this extra secret can use the transfer. Two signatures are checked in the circuit at all times (in case this mechanism is not used, the dual author key is internally set to the keys of the signer, this way the transfer still has two signatures, but the data remains the same and the same single signature can just be reused).

Transfers (like orders) use the storage tree instead of the account nonce for replay protection. This allows for more flexibility by e.g., allowing transfers to be executed out-of-order. We do this by requiring the storage slot data to be 0 for the transfer, and after the transaction is executed, the storage slot is set to 1, so the transfer cannot be executed a second time.

A transfer can also be approved using an on-chain signature or by approving the hash of the transaction using `approveTransaction`.

```
bytes32 constant public TRANSFER_TYPEHASH = keccak256(
    "Transfer(address from,address to,uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 validUntil,uint32 storageID)"
);
```

Not all features available for transfers using EdDSA signatures are available using on-chain authorization methods (like dual author transfers).

### Data-availability

```
- Type: 1 bytes (type > 0 for conditional transfers)
- From account ID: 4 bytes
- To account ID: 4 bytes
- Token ID: 2 bytes
- Amount: 3 bytes （24 bits, 19 bits for the mantissa part and 5 for the exponent part)
- Fee token ID: 2 bytes
- Fee amount: 2 bytes （16 bits, 11 bits for the mantissa part and 5 for the exponent part)
- StorageID: 4 bytes
- To: 20 bytes （only set when transferring to a new account)
- From: 20 bytes （only set for conditional transfers)
```

- => **22 bytes/transfer** (in the most common case)
- => Calldata cost: 22 \* 16 = **352 gas/transfer**

## Deposit

A user can deposit funds by calling `deposit`. If ERC-20 tokens are deposited, the user first needs to approve the Exchange contract so the contract can transfer them to the contract using `transferFrom`. **ETH is supported**, no need to wrap it in WETH when using off-chain balances.

A user can deposit to any Ethereum address, even if that address does not have an account yet.

A fee can be paid to the operator on-chain in ETH. No fixed fee is enforced because the operator is not required to process the deposit. If the operator does not process the deposit after `MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE` seconds, the user can withdraw the deposited amount + ETH fee directly from the exchange contract using `withdrawFromDepositRequest`.

### Gas cost

Depending on the specific token, the gas cost to the user is around 60,000 gas/deposit. There are several ways not to let users pay this gas cost:

- We only require users to approve the ERC20 token for the exchange (this method does not work for ETH). We can then use an agent that uses an on-chain signature of the user to make the actual deposit.
- A simple forwarder contract is used that can only deposit funds available inside the contract for a specific user. This contract can be deployed using `CREATE2` with a deterministic address. Once the user receives this address, the user can then do a simple transfer to this smart contract's address as usual. Anyone willing to pay the gas cost (in exchange for a fee paid by the user) can create the contract and deposit the funds (remember that how and to who is hardcoded inside the generated smart contract so this is always safe and trustless). Afterward, the smart contract can directly be destroyed to recoup the deployment gas cost partly.

Both methods allow the user to pay for the deposit in any token (on layer 1 or layer 2).

### Data-availability

```
- Owner: 20 bytes
- Account ID: 4 bytes
- Token ID: 2 bytes
- Amount: 12 bytes
```

- => **38 bytes/deposit (max)**
- => Calldata cost: 38 \* 16 = **608 gas/deposit**

## Withdraw

A withdrawal is used to transfer funds from layer 2 to layer 1. It can also be used more generally to allow the account owner to interact with layer 1.

```
Withdrawal {
  exchange (160bit)
  accountID (32bit)
  tokenID (16bit)
  amount (96bit)
  feeTokenID (16bit)
  fee (96bit)
  onchainDataHash (160bit)
  validUntil (32bit)
  nonce (32bit)
}
```

This data is hashed using Poseidon/t10f6p53 in the sequence given above. The hash is signed by the account owner using the private key associated with the public key stored in `account[accountID]`.

`onchainDataHash` contains extra data not directly used in the circuit and is calculated as follows:

```
bytes20 onchainDataHash = bytes20(keccak256(
    abi.encodePacked(
        minGas,
        to,
        extraData
    )
));
```

The withdrawal is made to the specified `to` address. The amount of gas provided for this withdrawal needs to be at least `minGas`. If the withdrawal fails, anyone can still withdraw the funds to `to` using `withdrawFromApprovedWithdrawal`.

The user can send extra data to the deposit contract stored into `extraData`. How this data is interpreted is left to the deposit contract, but the deposit contract can be sure the user has approved this data and can use it as it sees fit. Possible use cases for this are sending wrapped BTC on Ethereum to the account owner's BTC address. Another example is a meta transaction system where the user can do arbitrary contract calls (potentially directly after the withdrawal) very efficiently Most meta transaction overhead on-chain is very limited as replay protection, fee payment, and signature checks are done on layer 2 when possible.

`setWithdrawalRecipient` can be used to specify a different recipient address than was initially specified in the withdrawal request. This can be used to implement functionality like fast withdrawals.

A withdrawal can also be approved using an on-chain signature or by approving the hash of the transaction using `approveTransaction`.

```
bytes32 constant public WITHDRAWAL_TYPEHASH = keccak256(
  "Withdrawal(address owner,uint32 accountID,uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,address to,bytes extraData,uint minGas,uint32 validUntil,uint32 nonce)"
);
```

### Forced Withdrawals

It is possible to force the operator to process a withdrawal for the complete balance in an account. This is done by doing a withdrawal request on-chain using `forceWithdraw`. A fee in ETH needs to be paid for this request, and the fee paid by the user is fixed and decided by the Loopring contract at `forcedWithdrawalFee()`. `forceWithdraw` takes the account owner, the token address and the account ID as parameters. On-chain we do not know which account has which owner, or if the owner even has an account. So when this function is called, we do not know if it is a valid withdrawal (started by the account owner or an agent of his) or a withdrawal that needs to be ignored because it was started by someone that is not authorized to approve transactions for the account. The operator and circuits know if the withdrawal was valid or not, and if it is valid, the full balance is withdrawn; otherwise, the account is left unchanged.

The operator is allowed to process these forced withdrawals in any order but must process them within `MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE` seconds the request was made on-chain. From that point on, `notifyForcedRequestTooOld` can be called by anyone to enable withdrawal mode.

#### Withdrawal Fee Griefing

It is possible for the operator to seemingly refuse to process a normal withdrawal request until the user caves in and requests a forced withdrawal, but then still process the normal withdrawal request first. This way the operator receives fees twice for the same withdrawal, the normal withdrawal fee and the forced withdrawal fee. Fees will be low so this isn't that big of a problem. And the operator has every reason to keep users of the rollup happy, so in any normal case this isn't something an operator even wants to do.

This problem can be solved by making use of `validUntil` in the withdrawal request. The user can set a reasonably short time for the withdrawal request to be valid, and only does a forced withdrawal after the request has expired and the normal withdrawal still hasn't been processed.

### Data-availability

```
- Type: 1 bytes (type > 0 for conditional withdrawals, type == 2 for a valid forced withdrawal, type == 3 when invalid)
- Owner: 20 bytes
- Account ID: 4 bytes
- Token ID: 2 bytes
- Amount: 12 bytes
- Fee token ID: 2 bytes
- Fee amount: 2 bytes （16 bits, 11 bits for the mantissa part and 5 for the exponent part)
- Nonce: 4 bytes
- OnchainDataHash: 20 bytes
```

- => **67 bytes/withdrawal**
- => Calldata cost: 67 \* 16 = **1072 gas/withdrawal**

## Account Update

The EdDSA key of an account can be updated.

```
AccountUpdate {
  exchange (160bit)
  accountID (32bit)
  feeTokenID (16bit)
  fee (96bit)
  publicKeyX (254bit)
  publicKeyY (254bit)
  validUntil (32bit)
  nonce (32bit)
}
```

This data is hashed using Poseidon/t9f6p53 in the sequence given above. The hash is signed by the account owner using the private key associated with the public key stored in `account[accountID]`.

An account update can also be approved using an on-chain signature or by approving the hash of the transaction using `approveTransaction`.

```
bytes32 constant public ACCOUNTUPDATE_TYPEHASH = keccak256(
    "AccountUpdate(address owner,uint32 accountID,uint16 feeTokenID,uint96 maxFee,uint256 publicKey,uint32 validUntil,uint32 nonce)"
);
```

This allows setting the initial EdDSA key when an account was created without an EdDSA key set (e.g., when a transfer is done to a new account).

### Data-availability

```
- Type: 1 byte (type > 0 for a conditional transaction)
- Account owner: 20 bytes
- Account ID: 4 bytes
- Fee token ID: 2 bytes
- Fee amount: 2 bytes （16 bits, 11 bits for the mantissa part and 5 for the exponent part)
- Public key: 32 bytes
- Nonce: 4 bytes
```

- => **65 bytes/account update**
- => Calldata cost: 65 \* 16 = **1040 gas/account update**

## AMM Update

An AMM update can be approved using an on-chain signature or by approving the hash of the transaction using `approveTransaction`.

```
bytes32 constant public AMMUPDATE_TYPEHASH = keccak256(
      "AmmUpdate(address owner,uint32 accountID,uint16 tokenID,uint8 feeBips,uint96 tokenWeight,uint32 validUntil,uint32 nonce)"
  );
```

This transaction is used to update the fee bips expected for each trade by the account. Like other AMM designs, this is simply done by increasing the price of the token being sold, not by an additional token transfer, and is part of the AMM formula implemented in the protocol. It is also used to set the AMM weight of the specified token. The weights of the token directly impact the curve followed by the AMM.

The transaction also makes the balance of the specified token in the account available in the data-availability data. This is to facilitate efficient communication between layer 1 and layer 2. This is especially useful for the necessary logic needed on layer 1 to e.g., manage pool contracts for the AMM.

### Data-availability

```
- Account owner: 20 bytes
- Account ID: 4 bytes
- Token ID: 2 bytes
- AMM fee bips: 1 byte
- Token weight: 12 bytes
- Nonce: 4 bytes
- Balance: 12 bytes
```

- => **55 bytes/AMM update**
- => Calldata cost: 55 \* 16 = **880 gas/AMM update**

## Signature Verification

This transaction allows checking if an account owner signed some data (up to 253 bits) using EdDSA. This makes it possible to efficiently check EdDSA signatures on-chain.

### Data-availability

```
- Account owner: 20 bytes
- Account ID: 4 bytes
- Data: 32 bytes
```

- => **56 bytes/Signature verification**
- => Calldata cost: 56 \* 16 = **896 gas/Signature verification**

## No-op

This type of transactions have no effect and set the available data availability data to all zeros.

## Block

The operator needs to sign a block with the following data to authorize potential protocol fee payments from his account:

```
Block {
  publicInput (254bit)
  nonce
}
```

This data is hashed using Poseidon/t3f6p51 in the sequence given above. The hash is signed by the operator using the private key associated with the public key stored in `account[operatorAccountID]` with EdDSA.

The nonce of the operator account is increased by one after the block is processed.

A block can contain many conditional transactions. For each conditional transaction, the operator can send some extra data on-chain to be processed. This auxiliary data for each transaction can be an ECDSA signature or even the actual data needed for the transaction when only the hash of that data would otherwise be available.

### Data-availability

```
- Exchange address: 20 bytes
- Merkle root before: 32 bytes
- Merkle root after: 32 bytes
- Block timestamp: 4 bytes
- Protocol taker fee: 1 byte
- Protocol maker fee: 1 byte
- Num conditional transactions: 4 bytes
- Operator account ID: 4 bytes
- For every transaction (blockSize):
  - Transaction type: 1 byte
  - Transaction data: 67 bytes/transaction (padded with zeros when necessary)
```

Most blocks will contain transactions that only need a minimal amount of transaction data. As such, the data will contain many zeros. Compression is used on the full calldata of the block submission to reduce the calldata gas costs.

# Account Creation

There are multiple ways an account can be created for an Ethereum address:

- A transfer is done to an address that does not exist yet in the Merkle tree.
- A deposit is made to an address that does not exist yet in the Merkle tree.

Only the account owner can set the EdDSA public key for the account (directly or indirectly). This ensures that, if an account for an Ethereum address exists in the Merkle tree, it is indeed entirely owned by the owner. Otherwise, it would be possible to create an account for an Ethereum address, which is not owned by that address, which would be dangerous. The EdDSA public key will be stored in the Merkle tree for the account. This will ensure the account can be used for all transactions types as efficiently as possible.

It is possible to create multiple accounts for a single Ethereum address, though generally there is no need to do that.

# Signatures

## Off-chain signatures

We use EdDSA for signatures verified inside the circuits because they can be verified pretty efficiently. The data for an EdDSA signature is stored like this:

```
Signature {
  Rx (254bit)
  Ry (254bit)
  s (254bit)
}
```

When the EdDSA public key is part of the on-chain data-availability, the data is put on-chain in a compressed form. This reduces the amount of data from 64 bytes to 32 bytes, as the X coordinate can almost immediately be derived from the Y coordinate. More info on this can be found [here](https://ed25519.cr.yp.to/eddsa-20150704.pdf).

## On-chain signatures

On-chain we support multiple signature types:

- EIP712
- ETH_SIGN
- ERC1271 pass-through for smart contracts

Signatures data is stored in an opaque `bytes` field, the type of the signature is stored in the last byte.

It is also possible to directly approve a transaction by having the account owner or his agent call the `approveTransaction` smart contract function on the exchange contract.

# Forced Request Handling

Currently, only withdrawals have the option to force the operator to include the request in a block.

We want forced on-chain requests to be handled as quickly as possible by the operator. However, we also do not want to let operators be overwhelmed by the number of on-chain requests. The following rules apply:

- The maximum number of open forced requests is limited by `MAX_OPEN_FORCED_REQUESTS`. Anyone can check if there are available slots by calling `getNumAvailableForcedSlots`.
- If any request that is still open is older than `MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE` `notifyForcedRequestTooOld` can be called by anyone to enable withdrawal mode.

# Withdrawal Mode

The operator may stop submitting new blocks at any time. If that happens, we need to ensure that users can still withdraw their funds.

Exchange can go in withdrawal mode when a forced request is open for longer than `MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE`.

Once in withdrawal mode, almost all functionality of the exchange is stopped. The operator cannot submit any blocks anymore.
Users can only withdraw their funds using the state of the last block that was submitted:

- Balances still stored in the Merkle tree can be withdrawn with a Merkle proof by calling `withdrawFromMerkleTree`
- Deposits not yet included in a submitted block can be withdrawn (even when not in withdrawal mode after some time) using `withdrawFromDepositRequest`
- Approved withdrawals can manually be withdrawn (even when not in withdrawal mode) using `withdrawFromApprovedWithdrawal`

# Conditional Transactions

Conditional transactions are transactions that are approved on-chain by the account owner or an [agent](#Agents) of the account owner, either by an on-chain signature or by calling `approveTransaction`. This allows any on-chain mechanism (done by the account owner himself or by an [agent](#Agents)) to decide if a transaction can be executed or not.

# Agents

An agent is an address that is allowed to authorize on-chain operations for the account owner. By definition, the account owner is an agent for himself. `setAgentRegistry` can be used by the exchange owner to set the contract implementing this agent registration logic. On this contract, `isAgent` is called to check if `msg.sender` is authorized for the user's account.

Agents can be simple EOAs or smart contracts. Smart contracts are the most interesting case. This allows extending the exchange functionality by implementing extra logic on top of the basic exchange functionality built into the exchange contract. There is much functionality that can be added this way for users. Some examples:

- [Layer 1 composability](https://medium.com/loopring-protocol/composability-between-ethereum-layer-1-and-2-10650b7411e5)
- Fast withdrawals (by using a [conditional transfer](#Conditional-Transactions))
- Support for any 3rd party meta-transactions
- ...

# Brokers

A broker is someone that can manage orders for an account it does not own.

The account system is used for this. A user can create a special account for a broker, still with the user's Ethereum address as the owner, and deposit funds the broker can use. The user can now set the EdDSA keys to a set of keys known to the broker. The broker from that point has full access to the account and is authorized for all transactions. However, the owner of the account can revoke access to the account at any time by changing the EdDSA keys.

# Timestamp in Circuits

A block and its proof are always made for a fixed input. The operator cannot accurately know at what timestamp the block will be processed on the Ethereum blockchain, but he needs a fixed timestamp to create a block and its proof (the chosen timestamp impacts which orders are valid and invalid).

We do, however, know the approximate time the block will be committed to the Ethereum blockchain. When committing the block, the operator also includes the timestamp he used in the block (as a part of the public data). This timestamp is checked against the timestamp on-chain, and if the difference is less than `TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS` the block can be committed.

# Protocol Fee

The protocol fee is sent to the exchange account with `accountID == 0` and can be withdrawn from the exchange to the `ProtocolFeeVault` (this address is set for all exchanges on the Loopring contract) at any time without authorization (or forced using `withdrawProtocolFees` on the Exchange contract). The `ProtocolFeeVault` contains logic to distribute these funds between LRC stakers, LRC that will be burned, and the DAO fund. Non-LRC tokens are sold on-chain directly in a decentralized way.

# Throughput

The throughput is limited by:

- The cost of the data we have to send in the calldata for the on-chain data-availability.
- The `2^28` constraints limit that allows for efficient proof generation.

Without data-availability, we are only limited by the number of constraints in a single block.

The gas limit in an Ethereum block is currently 12,500,000 gas. An Ethereum block is generated every ~13 seconds (this is the case since the Muir Glacier HF).

From the yellow paper:

- 4 gas is paid for every zero byte of data or code for a transaction
- 16 gas is paid for every non-zero byte of data or code for a transaction

In the calculations, we always use 16 gas/byte for the worst case.

### On-chain Data-availability Limit

- Submitting a block (batched): ~220,000 gas (fixed cost) + ~80,000 gas/block
- => Using a single block of trades (theoretical): (12,500,000 - 300,000) / 400 = **30500 trades/Ethereum block = ~2350 trades/second**)

## Constraint Limit

We can only prove circuits with a maximum of `2^28` ~= 268M constraints efficiently (the roots-of-unity of the alt_bn128 curve is `2^28`, so we need to stay below `2^28` constraints so we can use FFT for generating the proof).

Currently, our ring settlement circuit with data-availability support uses ~130,000 constraints/ring:

- `2^28` / 130,000 = 2048 trades/block

## Results

In a single block, we are currently limited by the number of constraints used in the circuit. Multiple blocks can be submitted at once (+ more efficient batch verification for circuits of the same type) to mitigate this.

Using 7 blocks with on-chain data-availability (so that we are limited by the cost of data-availability):

- => (12,500,000 - (220,000 + 14 \* 80,000)) / 400 = ~28000 trades/Ethereum block = **~2150 trades/second**

For comparison, let us calculate the achievable throughput of the previous Loopring protocols that did the ring settlements completely on-chain.

- Gas cost/ring settlement: ~300,000 gas
- => 12,500,000 / 300,000 = 40 trades/Ethereum block = **3 trades/second**.

|                                        | Loopring 2  | Loopring 3 <br> (w/ Data Availability) |
| :------------------------------------- | :---------: | :------------------------------------: |
| Trades per Ethereum Block              |     40      |                 28,000                 |
| Trades per Second                      |      3      |                  2150                  |
| Cost per Trade                         | 300,000 gas |                450 gas                 |
| Cost in USD per Trade <br> (1ETH=XUSD) |     0.1     |                  X\*                   |

- _Cost in USD per Trade_ in the table does not cover off-chain proof generation.

The results given above are for the biggest circuits of size `2**28`. However, doing the trusted setup for circuits this big is challenging, so it is essential we can efficiently support submitting many smaller blocks at once. Here we show how the effect of the circuit size on the protocol's efficiency for trades with data availability.

| Circuit size | Trades/block | Trades/Ethereum block                                 | Trades/second | Gas/Trade |
| :----------: | :----------: | :---------------------------------------------------- | :-----------: | :-------: |
|   2\*\*28    |     2048     | (12,500,000 - (220,000 + 14 \* 80,000)) / 400 = 28000 |     2150      |    450    |
|   2\*\*27    |     1024     | (12,500,000 - (220,000 + 25 \* 80,000)) / 400 = 25700 |     1950      |    485    |
|   2\*\*26    |     512      | (12,500,000 - (220,000 + 43 \* 80,000)) / 400 = 22100 |     1700      |    560    |
|   2\*\*25    |     256      | (12,500,000 - (220,000 + 67 \* 80,000)) / 400 = 17300 |     1350      |    720    |
|   2\*\*24    |     128      | (12,500,000 - (220,000 + 94 \* 80,000)) / 400 = 11900 |      900      |   1050    |

## Proof Generation Cost

Using an AWS server, we can [generate proofs](https://medium.com/loopring-protocol/zksnark-prover-optimizations-3e9a3e5578c0) for circuits with `2**28` constraints in ~7 minutes costing ~\$0.0001/trade.

# Case Studies

## DEX with CEX-like Experience

### Setting up the exchange

The DEX can decide to use an existing exchange, so it does not need to set up its own infrastructure to handle block creation and creating proofs. This also makes it possible to share orders with all other parties using that exchange.

In this case, study, let us create a new exchange. The exchange owner just needs to call `createExchange` on the Loopring contract. This creates a brand new exchange contract.

### Trading

Users create orders using accounts created on the exchange. Orders are added to the order books of the DEX.

The DEX matches the order with another order. The order gets completely filled in the ring:

- The GUI of the DEX can be updated immediately with the state after the ring settlement. The order can be shown as filled, but not yet verified.
- The DEX sends the ring to the operator(s) of the exchange because they need to be settled in a reasonable time the operator calls `submitBlocks` after receiving a sufficient number of rings.

The DEX could now show an extra 'Verified" symbol for the filling of the order.

An order can be in the following states:

- **Unmatched** in an order-book
- **Matched** by the DEX
- **Submitted** in a block sent and verified on-chain in `submitBlocks`

Only when the block is submitted on-chain is the ring settlement irreversible.
