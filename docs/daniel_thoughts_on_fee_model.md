
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

We can choose to allow a finer control of this parameter by making *split* into: marginSplit, bSplit, fSplit. So the total income of a wallet for a order would be:
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
sFee * sSplit * (1 - sDiscount) & 
bFee * bSplit * (1 - bDiscount) & 
lFee * lSplit * (1 - lDiscount)
```

The same rules apply to the miner. All discount parameters should by default be 0. If it is `1`, means all fees are waived.
One principle is that miner cannot waive fees paying to wallet, and vice versa. 

## Why People have to use LRC as fee?
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

