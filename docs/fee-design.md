# Fee Design for Loopring protocol V2

This document lays out the design requirements and the resulting design of the fee calculations in Loopring protocol V2.

## Requirements

Fee calculations were very limited in protocol V1. For protocol V2 we aim to achieve the following:

- The fee calculation should be made as flexible as possible
- Fees should be able to be payed in one or a combination of the following
    1) LRC (and WETH? This doesn't really matter for the protocol)
    2) amountS
    3) amountB
    4) margin (in terms of amountS or amountB)
    
  The order in which the fees are paid can be important (e.g. first LRC and then amountS, or first margin and then amountB), so should be customizable if possible.
- Every order can request its own fee calculation
- Miners should be able to incentivize orders (for example market maker orders). These orders should be able to pay less fees (or even be payed some fees).
- The miner should be able to configure the minimum fee percentage it wants
- The wallet should be able to configure the minimum fee percentage it wants
- Wallets should be able to further share its fees with additional addresses
- If miner fee percentage + wallet fee percentage < 100%, we should maintain the requested ratio when scaling up to 100%
- It should be possible to buy integral units of tokens at a fixed price, without the fee payment still taking a part of the tokens bought/sold.
- (Fee calculation should be 'fair' per order in a ring. Loopring should not give all margin to a single order, but should spread out the margin over all orders.)
> Daniel: I assume all margin should be paid to miner and walelt by default, but miners can choose to share it or part of it with order owners.

Extra requirements not directly related to the fee calculations:

- The buyer can provide an address where the tokens he bought should be transferred to (which could be a contract)
- The seller should be able to transfer tokens to a contract from which the buyer can collect his tokens when the contract allows

## Fee calculation requirements imposed by the Loopring protocol

The Loopring protocol does not need to impose a lot of restraints on the fee calculation.
The user should use fee algorithms he knows give a fair fee calculation. The Loopring protocol does not know or care what 'good' fee rates are. 
With that being said, the loopring protocol will enforce the following requirements:

- Fees can only be payed by addresses that the Loopring protocol knows can be used for fee payments for the order
- Fees can be payed to any addresses, as long as the miner gets its requested fee percentage on every fee payment
- Fees should be payed in one of the fee payment methods listed in the requirments
- Orders can never be settled at amounts higher than calculated by the loopring protocol.
- Fee amounts should be less than 100% of the number of tokens bought/sold.
- If orders should be done in fixed units, the fee payments should keep the buy/sell amounts intact
- To give value to the LRC token, all fee contracts should still provide a benefit by using LRC. Maybe we could force at least paying a certain percentage of all fees in LRC (not sure about the economics of this)?
> Maybe certain fee-paying options, such as paying 5% of tokenB, are only available if the actual LRC fee is greater than for example 0.1%, otherwise the match would fail.

> Another possible requirement is that miners makde decisions for themselves, but not for wallets. If miners wants to give a 50% discount of all types of fees, this will only affect the income of the miner, but not the wallet. Wallets can also do discount for themselves.

The fee calculation algorithm can do anything it wants as long as it respects the above rules. The loopring protocol will check these requirements before doing the token transfers.

## Design overview

### Fee method and algorithm data encoding

The fee calculation should be as flexible as possible, so we don't want to enforce a single way of doing the fee calculation.
For example, fees can be calculated in the following ways (NOT a complete list!):
- In the Loopring protocol itself
- In an external contract
- In a simple language laying out the rules how the fees should be payed
- ...

To make the fee design compatible with any of the above and more, the data needed for the fee calculation will be stored in the order in a way similar to Multihash:
- First byte: The fee calculation method
- Second byte: Payload size
- Following bytes: The payload

The fee calculation method can be any way to calculate the fees above (internal algorithm embedded in Loopring, external contract, ...).
For example, if we want to calculate the fees using an internal fee calculation algorithm, we could set the fee calculation method to '0'. In the payload we can encode how many LRC tokens we want to pay as fees.
Another example would be to pay the fees using an external contract. Here we could set the fee calculation mode to '1'. The payload would contain the address of the fee calculation contract and all data needed to run that contract.

### Fee algorithm

The fee algorithm is responsible for generating a list of payments for an order. To do this, the algorithm will of course need access to some data. The fee algorithm needs to have data about the order it needs to calculate fees for, but it may also need some algorithm specific data to calculate it.

We should keep the interface as flexible as possible. The interface looks as follows:
```
IFeeAlgorithm {
    // The minimum part of the total fees this fee contract wants to pay out to non-miner addresses
    function getMinimumFeePercentage public returns uint();
    
    // Returns the list of payments that need to be done for this order
    // order: all necessary order data a fee algorithm could need
    // customFeeData: data that is algorithm specific used for this specific algorithm
    // return value: all payments that should be done for the order
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
}
```

The fee algorithm may also want to share some of the fees with an address different than the miner (e.g. a wallet address). How big a part of the fees it wants can be configured and can be queried by the Loopring protocol by calling ```getMinimumFeePercentage()```. This allows the protocol to check if the miner is happy to split this this much of his fees with the fee algorithm.

Furthermore, when submitting the orders to the Loopring protocol, the miner can insert an additional fee percentage factor for every order independently. This fee percentage factor will be applied to the original fee amounts calculated by the fee algorithm. This not only allows the miner to reduce the fees that need to paid by the owner (or even completely reduce them to zero), but even allows the miner to pay out the fees to the owner of the order. When the order owner gets paid fees for the order, these will come from the part of the miner, not from the part of e.g. the wallet.

The payments returned should at least contain the payment to actually settle the order. All other payments are considered fee payments. For every fee payment we do 2 token transfers:
- A transfer going to the original receiving address given by the fee algorithm, but with the amount reduced by the miner fee percentage.
- A transfer going the miner to pay its share of the fees.

This allows the fee algorithm to pay fees to as many addresses it wants, while ensuring the miner gets its split on every one of those fee payments.

### Custom token transfers

To support non-standard token transfers, it is possible to do the token transfers using a contract implementing the TokenTransfer interface:
```
ITokenTransfer {
    // For now, the same transferFrom function parameters as ERC20
    function transferFrom(address from, address to, uint256 amount) public returns (bool);
}
```

This allows tokens to be transferred in many ways. Using an ICO as an example, tokens might not actually be transferred directly to the buyer, but stay locked in the ICO contract. A custom contract implementing the TokenTransfer interface can be made that can correctly interact with the ICO contract. By using this interface, the Loopring protocol is still aware of all token transfers that happen.

This custom token transfer contract can be added as an optional parameter in the order selling the tokens. The order buying the tokens should specifically allow the use of this custom token transfer contract so this cannot be misused. 
Another option would be to use the custom transfer contract as the 'token' that is bought. This would create a market specifically for this contract.

> Daniel's question: I think this ITokenTransfer address parameter should only be used to transfer token between orders, not between order and miner/wallet, right? The challanging part is that the wallet can provide a mallicious implementation of this interface and will cause the taker to lose all money. One solution to this is the foundation acts as a gate keeper to whitelist all ITokenTransfer implementation addresses.

## Example fee algorithms

The following are just a few of the possible fee payment algorithms possible in the design.

#### Priority Algorithm: Pay fees using a prioritized list of fee payment methods
Order defines as many as it wants of the following:
- max LRC fee
- max amountS fee percentage
- max amountB fee percentage
- if margin can be used

AND the order it wants to pay them! If no max amount of one of the fee methods is not given, it should never be used for fee payment.

Fees should be payed using the priority given until an accumulated percentage of 100% is reached:
e.g. for a completed order 50% of the LRC fee can be used + 25% of the amountS fee percentage can be used + 25% of the amountB fee percentage can be used

```
percentage of all used fees together should add up to 100%).
{	
    function getMinimumFeePercentage()
    {
        // Miner gets all the fees
        return 0;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {
        uint feePriorityList = extractUint(customFeeData);
        uint maxLRCFee = (customFeeData.hasLRC()) ? extractUint(customFeeData) : 0;
        uint8 maxAmountSPercentageFee = (customFeeData.hasAmountS()) ? extractUint8(customFeeData) : 0;
        uint8 maxAmountBPercentageFee = (customFeeData.hasAmountS()) ? extractUint8(customFeeData) : 0;
        bool allowMargin = customFeeData.allowMargin();
        
        // Run down the prioritized list of fee payments methods and pay the fees if possible.
	// If not possible for some reason go to the next item in the list
        
        return Payment[];
    }
}
```

#### General Algorithm: Pay fees using all available fee payment methods equally
Order defines as many as it wants of the following:
- max LRC fee
- max amountS fee percentage
- max amountB fee percentage
- if margin can be used

All max fee amounts given can be used: i.e. for a completed order all LRC fee can be used + all amountS fee percentage can be used + all amountB fee percentage can be used. Total fee payments can be reduced equally if margin can be used.

```
percentage of all used fees together should add up to 100%).
{	
    function getMinimumFeePercentage()
    {
        // Miner gets all the fees
        return 0;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {
        uint maxLRCFee = (customFeeData.hasLRC()) ? extractUint(customFeeData) : 0;
        uint8 maxAmountSPercentageFee = (customFeeData.hasAmountS()) ? extractUint8(customFeeData) : 0;
        uint8 maxAmountBPercentageFee = (customFeeData.hasAmountB()) ? extractUint8(customFeeData) : 0;
	bool allowMargin = customFeeData.allowMargin();
        
        // Do simple fee calculations using the above values
        
        return Payment[];
    }
}
```

#### Wallet Algorithm: Pay part of the fees to the miner and part of the fees to wallet addresses
This fee algorithm will pay part of the fees to one or more addresses that can be configured. The percentage of the fees the algorithm wants can also be configured.

For wallets this logic could be made part of the Loopring protocol for efficiency, but the fee algorithms are powerful enough that this isn't needed.

```
{
    public uint8 minimumWalletFeePercentage;
    public PaymentAddress paymentAddresses[];
    
    struct PaymentAddress
    {
        address feeRecipient;
        uint8 percentageSplit;
    }
    
    function getMinimumFeePercentage()
    {
        return minimumWalletFeePercentage;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {
        // Calculate the fees in some way 
        // (could write custom code, could call another contract for this, use a library made available by loopring, 
        //  the fee contract that should be used could be stored inside the customFeeData ...)
        // Setup the fee payments like 100% would go to the payment addresses.
        // The loopring protocol will ensure the miner will get its share of the fees.
        return Payment[];
    }
}
```

#### ICO Seller Algorithm
This is a fee algorithm that specifically can be used for ICOs on Loopring.

```
{
    public address feePayer;
    public address ICOContract;
    
    function getMinimumFeePercentage() {
        // This contract wants all fees to go to the miner
        return 0;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {	
        // If the order owner doesn't want to pay any fees we can let a feePayer
        // pay them to keep the miners happy.
        // Do not that the feePayer should specifically be allowed for this order.
        // Should not mess with paying fees in fillAmountB or fillAmountS to ensure the original rate 
	// is kept intact (to support fixed units)
        return Payment[];
    }
	
    // Optional: can implement the TokenTransfer interface to communicate with the ICO contract to lock tokens
    // Another way of doing this is to implement this method directly on the ICO contract or in a separate contract
    function transferFrom(address from, address to, uint256 value) public returns (bool)
    {
        // This function should only be called from the loopring contract
        // Lock the tokens in the ICO contract
        ICOContract.lockTokens(from, to, value);
    }
}
```

#### ICO Buyer Algorithm
This is a fee algorithm that specifically can be used for buying from ICOs on Loopring.

```
{
    function getMinimumFeePercentage() {
        // This contract wants all fees to go to the miner
        return 0;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {	
        // By default, does not pay any fees for this order.
        // Should not mess with paying fees in fillAmountB or fillAmountS to ensure the original rate 
	// is kept intact (to support fixed units)
	// Should also simply disregard all margin so it gets all tokens at the expected ratio.
        return Payment[];
    }
}
```

## Example use cases

#### Order using LRC as fee
The order uses the Default Algorithm, only passes LRC as an option with a set max amount.

#### Order using LRC and an amountS percentage as fee equally
The order uses the Default Algorithm, and passes LRC and amountS parameters.

#### Order paying fees only in margin
Orders uses the Default Algorithm or the Priority Algorithm, with all fee amount parameters set to 0, except the LRC fee parameter.

#### Order prefers paying fees in margin but also allows payment in amountS
Order uses the Priority Algorithm. Passes that the margin can be used first, as a second option a percentage of amountS can also be used.

#### Order paying fees to the wallet
The order uses the Wallet Algorithm. Currently the wallet can decide what fee payment options are allowed. If we integrate the wallet functionality inside the Loopring protocol the order can use any fee algorithm it wants.

#### Miner wants an order to only pay 50% of its fees
An order was submitted using any fee algorithm. The miner will send an additional fee percentage factor of 50% for the order when submitting it to the Loopring protocol for settling. Whatever fees would normally have been payed by the order are now reduced to 50%.

#### Order selling ICO tokens
- Create and deploy a contract implementing the TokenTransfer interface
- Pass in a valid TokenTransfer contract in the order selling the tokens
- Pass in the ICO Seller Algorithm as the fee model.

Optional: 
- Setup a fee payer address that can pay fees in LRC to ensure the correct ICO rate
- Make sure the fee payer is allowed to pay fees for this order

TODO: Can the existing OrderBroker functionality be used for this?


#### Order buying from ICO tokens
Here the order is created with the ICO Buyer Algorithm.

Note: This order shouldn't really have to pay any fees, the sell order of the ICO should pay enough fees that this shouldn't be needed. However, this order could pay additional fees so miners are incentivized to process it earlier than other buy orders. If this is unwanted, a possible solution for this would be to force ICO orders to be processed FIFO.

TODO: Is this correct?

#### More cases to be added...

## Possible problems

#### Miners should be able to predict how much fee he will get

The miner cannot easily know how much fee it is going to get, so he doesn't know if it's worth the gas cost to settle a ring. Maybe we need enforce a minimum amount of fees that needs to be paid that the miner that he can easily figure out? Or maybe it's not too expensive for the miner to execute the fee contract locally and check the results?

#### When fee algorithms are implemented in contracts they can do fee payments without the Loopring protocol knowing

The miner should get its part of all fee payments, but we can only impose this if the Loopring knows all fee payments that are done. This a problem if we want anyone to be able to make fee algorithm contracts. Unless we check the byte code of the contract inside the Loopring protocol, we cannot know if some payments are done in the ```calculateFees``` function. We could work around this by having some control about which fee contracts are allowed to be used (like whitelisting them in a FeeContractRegistry).

> Daniel: I guess  whitelisting is the only way, otherwise the fee transfer will be totally out of control.

#### Fee algorithms can use 100% of the available LRC balance of the fee payer

While we can limit the number of tokenS and tokenB payed as fees because we know the order size, the Loopring protocol does not know what the maximum LRC amount is that can be used as fees for the order. In the worst case the fee algorithm decides to use all LRC available, even if this was not wanted.

> Daniel: The protocol acutally knows the max amount of LRC an order can use as fee, this is denoated by the 'lrcFee' field of the order. If the order is fully filled, lrcFee is the amount of LRC to pay accumulatively.

## Overview of the fee calculation design using different contracts for the fee calculations

The following high-level implementation is only done to test the design. It is not meant to be actually implemented this way.

```
//
// All data needed by the fee contract to calculate the fees
//
struct Order
{
    owner,
    from,
    to,
    feePayer,
    hash,
    amountS,
    amountB,
    fillAmountS,
    fillAmountB,
    marginS,
    lrcFee,
	
    availableLRC, // We need to keep this up to date after each order because we might have used up some available LRC for previous orders
}

//
// All data needed by the loopring protocol to do a transaction
//
struct Payment
{
    token,
    from,
    to,
    amount,
}

//
// Loopring protocol
//
{
    // Setup ring etc...
    
    // Calculate ring settlement amounts (fillAmountS, fillAmountB, margin, ...)
    
    // If there is some margin the margin should be split over all orders equally so the fee contract for every order can decide what to do with it
    
    foreach(order in ring) {
    
        // The miner can give an additional fee factor per order to lessen its fees (order incentive for market makers, etc...)
        // If the percentage is negative the order owner will receive the fees, not the miner/wallet.
        int feeFactor = order.feeFactor;
        require(feeFactor <= 100 && feeFactor >= -100);
        
        // Get the minimum miner and fee contract fee percentage
        uint minimumMinerFeePercenage = minerRegistry.getMinimumFeePercentage(miner);
        uint minimumFeeContractFeePercenage = order.feeContract.getMinimumFeePercentage(miner);
        
        if(minimumMinerFeePercenage + minimumFeeContractFeePercenage > 100) {
            // Minimum fee percentages cannot be achieved
            ring.valid = false;
            continue;
        }
        
        // Make sure 100% of the fees are paid, and keep the ratio of the requested fees intact
        uint minerFeePercentage = minerFeePercentage / (minimumMinerFeePercenage + minimumFeeContractFeePercenage);
        uint feeContractFeePercentage = 100 - minerFeePercentage;
        
        // Get the payments associated with this 
        Payment payments[] = order.feeContract.calculateFees(order, order.customFeeData);
		
        // Check if the fee contract calculated valid fee payments
        ring.valid = checkPaymentsAreValid(payments);
        
        // Payments will contain a single transaction actually being used to settle the order.
        // Every other transaction is a fee payment, so the miner needs to take its cut
        foreach (payment in payments) {
            if(order settle payment) {
                continue;
            }
            // Duplicate the payment here:
            // - First payment will go to the original address of the payment, but with its original amount reduced by the miner fee
            uint minerFeePart = payment.amount * minerFeePercentage * feeFactor / (100*100);
            payment.amount -= minerFeePart;
            // - Second payment will pay the miner
            payment.to = miner;
            payment.amount = minerFeePart;		
            payments.push(payment);		
        }
    }
	
    foreach(payment in payments) {
        if(order.tokenTransferContract) {
            // Pay the tokens using the TokenTransfer contract
        } else {
            // Pay the tokens using ERC20
        }
    }
}
```
