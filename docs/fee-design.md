# Fee design for Loopring protocol V2

## Requirements
- The fee calculation should should be made as flexible as possible
- Fees should be able to be payed in one or a combination of the following
    1) LRC (and WETH? This doesn't realy matter for the protocol)
    2) amountS
    3) amountB
    4) margin
    
  The order in which the fees are paid can be important (e.g. first LRC and than amountS, or first amountB and then LRC), so should be customizable if possible.
- Every order can request its own fee calculation
- Miners should be able to incentivize  orders (for example market maker orders). These orders should be able to pay less fees (or even be payed some fees).
- The miner should be able to configure the minimum fee percentage it wants
- The wallet should be able to configure the minimum fee percentage it wants
- Wallets should be able to further share its fees with additional addresses
- If miner fee percentage + wallet fee percentage < 100%, we should maintain the requested ratio when scaling up to 100%
- It should be possible to buy integral units of tokens at a fixed price, without the fee payment still taking a part of the tokens bought/sold.
- (Fee calculation should be 'fair' per order in a ring. Loopring should not give all margin to a single order, but should spread out the margin over all orders.)

TODO: More requirements?

Extra requirements not directly related to the fee calculations:

- The buyer can provide an address where the tokens he bought should be transfered to (which could be a contract)
- The seller should be able to transfer tokens to a contract from which the buyer can collect his tokens when the contract allows

## Fee calculation requirements imposed by the Loopring protocol

The Loopring protocol does not need to impose a lot of restraints on the fee calculation.
The user should use fee contracts he knows gives a fair fee calculation. The Loopring protocol does not know or care what 'good' fee rates are. 
With that being said, the loopring protocol will enforce the following requirements:

- Fees should be payed in one of the fee payment methods listed in the requirments
- Fees payed to the miner should at least be the requested percentage requested by the miner
- Orders can never be settled at amounts higher than calculated by the loopring protocol.
- Fee amounts should be less than 100% of the amount of tokens bought/sold.
- If orders should be done in fixed units, the fee payments should keep the buy/sell amounts intact
- To give value to the LRC token, all fee contracts should still provide a benefit by using LRC. Maybe we could force at least paying a certain percentage of all fees in LRC (not sure about the economics of this)?

TODO: More fee contract constraints?

TODO: The miner cannot easily know how much fee it is going to get, so he doesn't know if it's worth the gas cost to settle a ring. Maybe we need enforce a minimum amount of fees that needs to be paid that the miner that he can easily figure out? Or maybe it's not too expensive for the miner to execute the fee conract locally and check the results?

The fee calculation algorithm can do anything it wants as long as it respects the above rules. The loopring protocol will check these requirements before doing the token transfers.
For example, a fee algorithm can do the following:
- Can pay fees anyway it wants using any of the fee payment methods listed in the requirments
- Can decide what happens with the margin. Can decide to give everything to the miner, and/or can decide to reduce fees of the order 
- Fee payments can be done TO any addresses (the protocol will ensure the miner gets paid for all these payments)
- Fee payments can de done FROM any addresses (allowing an address other than the order owner to pay fees)
- ...

## Design overview

The fee calculation should be as flexible as possible, so we don't want to enforce a single way of doing the fee calculation.
For exmpample, fees can be calculated in the following ways (NOT a complete list!):
- In the Loopring protocal itself
- In an external contract
- In a simple language laying out the rules how the fees should be payed
- ...

To make the fee design compatible with any of the above and more, we will encode the fee data in a way similar to multihash:
- First byte: The fee calculation method
- Second byte: Payload size
- Following bytes: The payload

The fee calculation mode can be any way to calculate the fees above (internal algorithm embedded in Loopring, external contract, ...).
For example, if we want to calculate the fees using an internal fee calculation algorithm, we could set the fee calculation method to '0'. In the payload we can encode for example how many LRC tokens we want to pay as fees.
Another example would be to pay the fees using an external contract. Here we could set the fee calculation mode to '1'. The payload would contain the address of the fee calculation contract and all data needed to run that contract.

TODO: Further describe the design

## Use cases

- Order using LRC as fee:
Orders uses the Default fee contract, with all fee amount parameters set to 0, except the LRC fee parameter.

- Order using LRC and amountS percentage as fee:

- Order preferring buying fees in amountB but also allows payment in LRC:

- Order from a wallet paying fees in LRC:

- Miner wants an order to only pay 50% of its fees:

- Order without paying any fees:
Orders uses the Default fee contract, with all fee amount parameters set to 0, except the LRC fee parameter.

- Order selling ICO tokens:
Creates an order using the ICO fee contract.

- Order buying from ICO tokens:

- ...

TODO: work out use cases

## Overview of the fee calculation design using different contracts for the fee calculations

The following high level implementation is only done to test the design. It is not meant to be actually implemented this way.

```
//
// TokenReceiver interface
// Used to support transfering tokens not in an ERC20 way, e.g. by locking them in an ICO contract
//
{
    function transferFrom(address from, address to, uint256 amount) public returns (bool);
}


//
// All data needed by the fee contract to calculate the fees
//
struct Order
{
    owner,
    from,
    to,
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
    to,			(can be an address to a TokenReceiver contract)
    amount,
}

//
// Fee contract interface
//
{
    // The minimum part of the total fees this fee contract wants to pay out to non-miner addresses
    function getMinimumFeePercentage public returns uint()
    {
         // returns the minimum fee percentage this fee model wants
    }
    
    // Returns the list of payments that need to be done for this order
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {
        // Can use customFeeData (stored in the order data) if needed
        // Can be used to send 
        return Payment[];
    }
}

//
// Default fee contract
//
// Order defines as many as it wants of the following:
// - max LRC fee
// - max amountS fee percentage
// - max amountB fee percentage
// All max fee amounts can be used: i.e. for a completed order all LRC fee can be used + all amountS fee percentage can be used + all amountB fee percentage can be used
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
        uint8 maxAmountBPercentageFee = (customFeeData.hasAmountS()) ? extractUint8(customFeeData) : 0;
        
        // Do fee calculations using the above values
        
        return Payment[];
    }
}

//
// Default 'priority' fee contract
//
// Order defines as many as it wants of the following:
// - max LRC fee
// - max amountS fee percentage
// - max amountB fee percentage
// AND the order it wants to pay them! If no max amount of one of the fee methods is not given, it should never be used for fee payment.
// Fees should be payed using the priority of each given, until an accumulated percentage of 100% is reached:
//  e.g. for a completed order 50% of the LRC fee can be used + 25% of the amountS fee percentage can be used + 25% of the amountB fee percentage can be used
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
        
        // Do fee calculations using the above values
        
        return Payment[];
    }
}

//
// Wallet fee contract
// TODO: The wallet logic could be made part of the Loopring protocol for efficiency,
// but the fee contracts are powerful enough that this isn't needed.
//
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

//
// ICO fee contract
//
{
    public address feePayer;
    public address ICOContract;
    public address sellOrderOwner;
    
    function getMinimumFeePercentage() {
        // This contract wants all fees to go to the miner
        return 0;
    }
    
    function calculateFees(Order order, bytes customFeeData) public returns Payment[]
    {
        // Because the order owner doesn't want to pay any fees (to maintain a fixed price ratio), we let a feePayer
        // pay some fees to keep the miners happy.		
        // Should not mess with paying fees in fillAmountB or fillAmountS to ensure the original rate is kept intact (to support fixed units)
        // The Payment.to value can be a TokenReceiver contract address. Either the ICO contract itself can implement it or
        // this contract can be used as a proxy to communciate with the ICO contract.
        // Additionaly, we don't want everyone to be able to use this contract, because everyone would like its fees payed by someone else.
        // So, for example, we could check the owner address here to see if this is indeed an order we would like to pay fees for.
        if (sellOrderOwner != order.owner) {
            // Don't do any payments, this fee contract cannot be used
            return;
        }
        return Payment[];
    }
	
    // Optional: can implement the TokenReceiver interface to communicate with the ICO contract to lock tokens
    // Another way of doing this is to implement this method directly on the ICO contract
    function transferFrom(address from, address to, uint256 value) public returns (bool)
    {
        // Lock the tokens in the ICO contract
        ICOContract.lockTokens(from, to, value);
    }
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
        if(payment.to.isContract()) {
            // Pay the tokens using the TokenReceiver contract interface
        } else {
            // Pay the tokens using ERC20
        }
    }
}
```
