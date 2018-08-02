
# Daniel's Thoughts on Fee Modelling

These thoughts are based on this [article](https://github.com/Loopring/protocol2/blob/master/docs/rate_and_margin_calculation.md#what-you-can-learn-from-this-simulation).

**Especially:**

A order will potentially send:
    - tokenS to the previous order (fillAmountS, which is exactly the same as the previous order's fillAmountB)
    - tokenS to the miner/wallet as margin (margin)
    - a percentage of tokenS as one type of fee (sFee)
    - a percentage of tokenB as one type of fee (bFee)
    - a percentage of LRC as one type of fee (lFee)
    
**if the above assumptions are incorrect, please stop reading and lets talk.**
    
## Fee Splitting between wallet and miner
Like in v1, we can allow wallets to set a **fee-splitting percentage** parameter, *split*, for each order. If the order is put inside a ring by a miner, that implicits the miner accepts (1-split) as fee sharing parameter.

We can choose to allow a finer control of this parameter by making *split* into: marginSplit, sSplit, bSplit, fSplit. So the total income of a wallet for a order would be:
```
margin * marginSplit & 
sFee * sSplit & 
bFee * bSplit & 
lFee * lSplit
```
, while the miner will get:
```
margin * (1 - marginSplit) &
sFee * (1 - sSplit) &
bFee * (1 - bSplit) &
lFee * (1 - lSplit)
```

## Fee Discount
Wallet and miner can choose to give discount to a fee. If the disount a wallet specified is marginDiscount, sDiscount, bDiscount, and lDiscount, then its income would be:

```
margin * marginSplit* (1 - marginDiscount) & 
sFee * sSplit * (1 - marginDiscount) & 
bFee * bSplit * (1 - marginDiscount) & 
lFee * lSplit * (1 - marginDiscount)
```

The same rules apply to the miner. All discount parameters should by default be 0. If it is `1`, means all fees are waived.
One principle is that miner cannot waive fees paying to wallet, and vice versa. 


## General Parameters to FeeModel and Per-Model parameters

For each order, a fee model method or smart contract should have access to the following informaiton:

- tokenS: address of token to sell
- tokenB: address of token to sell
- lrcAddress: LRC token smart contract address
- margin: amount of tokenS as margin
- sFee: amount of tokenS as fee
- bFee: amount of tokenB as fee
- lFee: amount of LRC as fee
- owner: owning address of this order (where tokenS will be transfered from)
- receiveFrom: the next order's owner address in the ring
- sendTo: the previous order's owner address in the ring
- miner: miner address
- wallet: wallet address
- feeModelMethod: fee model method (integer), 0 means the next parameter (bytes) containts a fee model smart contract address at the very begining.
- bytes: model-specific address (optioanl) and parameters


## Thought on Fee Percentage as basic points
we can use a number to represent the basic points, not percentage. Thus 1% is expressed as 100, and 100% is expressed as 100000. Thus a uint16 is good enough to express a percentage.
0.00001525902x

## Why people want to use LRC as fee?

If we remove LRC from the picture, the fee model also works. So why people want to use LRC then?

**MAYBE THE BEST TOKEN ECONOMY FOR LOOPRING IS STILL THE SAME AS PROTOCOL V1**:

"miner either choose LRC as fee, or choose margin as fee but has to pay the same amount of LRC to order owner."

In case the miner doesn't have any LRC to pay

### 0-LRC Penalty

If for a order, the actual LRC fee or reward is 0, the order's tokenS will be charged a 1% fee by the protocol.

### Price Movement Indicator

We can refer the latter one as "miner buys the margin with LRC". What's the buy price? Lets assume the LRC fee is *x* and the   margin is *y* amountS, the price is actually *2x/y* per 1 unit of amountS in terms of LRC.

Lets assume the fair market price of 1 unit of amountS, *f* is know to the miner, then if *2x/y* is smaller than *f*, miner will choose margin, otherwise it will choose LRC fee. We can have:

- choose margin,then price(1 amountS) >= **2x/y** LRC
- choose LRC fee, then price(1 amountS) <= **2x/y** LRC

This might be a way to calculate a moving average price for amountS in a decentralized way.



