
# Daniel's Thoughts on Fee Modelling

These thoughts are based on this [article](https://github.com/Loopring/protocol2/blob/master/docs/rate_and_margin_calculation.md#what-you-can-learn-from-this-simulation).

Especially:
   A order will potentially send:
    - tokenS to the previous order (fillAmountS, which is exactly the same as the previous order's fillAmountB)
    - tokenS to the miner/wallet as margin (margin)
    - a percentage of tokenS as one type of fee (sFee)
    - a percentage of tokenB as one type of fee (bFee)
    - a percentage of LRC as one type of fee (lFee)
    
    If we group all fees by token type, then we have:
    - tokenS: margin + sFee (denoted as sFeeTotal)
    - tokenB: bFee
    - LRC: lFee.
    
    
## Fee Splitting between wallet and miner
Like in v1, we can allow wallets to set a **fee-splitting percentage** parameter, *split* (defaults to 0.5), for each order. If the order is put inside a ring by a miner, that implicits the miner accepts (1-split) as fee sharing parameter.

We can choose to allow finer control of this parameter by making *split* into 4: marginSplit for margin, sSplit, bSplit, fSplit. So the total income of a wallet for a order would be:
```
margin * marginSplit + 
sFee * sSplit + 
bFee * bSplit + 
lFee * lSplit
```
, while the miner will get:
```
margin * (1 - marginSplit) +
sFee * (1 - sSplit) + 
bFee * (1 - bSplit) + 
lFee * (1 - lSplit)
```

## Fee Discount
Wallet and miner can choose to give discount to a fee. If the disount a wallet specified is marginDiscount, sDiscount, bDiscount, and lDiscount, then its income would be:

```
margin * marginSplit* (1 - marginDiscount) + 
sFee * sSplit * (1 - marginDiscount) + 
bFee * bSplit * (1 - marginDiscount) + 
lFee * lSplit * (1 - marginDiscount)
```

And the the followng was send back to the order owner (not the miner)

```
margin * marginSplit* marginDiscount + 
sFee * sSplit * sDiscount + 
bFee * bSplit * bDiscount + 
lFee * lSplit * lDiscount
```

The same rules apply to the miner. All discount parameters should by default be 0. If it is `1`, means all fees are waived.
One principle is that miner cannot waive fees paying to wallet, and vice versa. 
