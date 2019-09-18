/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.7;

import "../iface/IRingSubmitter.sol";
import "../impl/Data.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "./OrderHelper.sol";
import "./ParticipationHelper.sol";


/// @title RingHelper
library RingHelper {
    using MathUint for uint;
    using OrderHelper for Data.Order;
    using ParticipationHelper for Data.Participation;

    /// @dev   Event emitted when fee rebates are distributed (waiveFeePercentage < 0)
    ///         _ringHash   The hash of the ring whose order(s) will receive the rebate
    ///         _orderHash  The hash of the order that will receive the rebate
    ///         _feeToken   The address of the token that will be paid to the _orderHash's owner
    ///         _feeAmount  The amount to be paid to the owner
    event DistributeFeeRebate(
        bytes32 indexed _ringHash,
        bytes32 indexed _orderHash,
        address         _feeToken,
        uint            _feeAmount
    );

    function updateHash(
        Data.Ring memory ring
        )
        internal
        pure
    {
        uint ringSize = ring.size;
        bytes32 hash;
        assembly {
            let data := mload(0x40)
            let ptr := data
            let participations := mload(add(ring, 32))                                  // ring.participations
            for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                let participation := mload(add(participations, add(32, mul(i, 32))))    // participations[i]
                let order := mload(participation)                                       // participation.order

                let waiveFeePercentage := and(mload(add(order, 672)), 0xFFFF)           // order.waiveFeePercentage
                let orderHash := mload(add(order, 864))                                 // order.hash

                mstore(add(ptr, 2), waiveFeePercentage)
                mstore(ptr, orderHash)

                ptr := add(ptr, 34)
            }
            hash := keccak256(data, sub(ptr, data))
        }
        ring.hash = hash;
    }

    function calculateFillAmountAndFee(
        Data.Ring memory ring,
        Data.Context memory ctx
        )
        internal
        view
    {
        // Invalid order data could cause a divide by zero in the calculations
        if (!ring.valid) {
            return;
        }

        uint i;
        uint prevIndex;

        for (i = 0; i < ring.size; i++) {
            ring.participations[i].setMaxFillAmounts(
                ctx
            );
        }

        // Match the orders
        Data.Participation memory taker = ring.participations[0];
        Data.Participation memory maker = ring.participations[1];

        if (taker.order.isBuy()) {
            uint spread = matchRing(taker, maker);
            taker.fillAmountS = maker.fillAmountB; // For BUY orders owner can sell less to get what is wanted (keeps spread)
            taker.splitS = spread;
        } else {
            matchRing(maker, taker);
            taker.fillAmountB = maker.fillAmountS; // For SELL orders owner sells max and can get more than expected (spends spread)
            taker.splitS = 0;
        }

        maker.splitS = 0;

        // Validate matched orders
        for (i = 0; i < ring.size; i++) {
            // Check if the fill amounts of the participation are valid
            ring.valid = ring.valid && ring.participations[i].checkFills();

            // Reserve the total amount tokenS used for all the orders
            // (e.g. the owner of order 0 could use LRC as feeToken in order 0, while
            // the same owner can also sell LRC in order 2).
            ring.participations[i].order.reserveAmountS(ring.participations[i].fillAmountS);
        }

        for (i = 0; i < ring.size; i++) {
            prevIndex = (i + ring.size - 1) % ring.size;

            bool valid = ring.participations[i].calculateFees(ring.participations[prevIndex], ctx);
            if (!valid) {
                ring.valid = false;
                break;
            }

            int16 waiveFeePercentage = ring.participations[i].order.waiveFeePercentage;
            if (waiveFeePercentage < 0) {
                ring.minerFeesToOrdersPercentage += uint(-waiveFeePercentage);
            }
        }
        // Miner can only distribute 100% of its fees to all orders combined
        ring.valid = ring.valid && (ring.minerFeesToOrdersPercentage <= ctx.feePercentageBase);

        // Ring calculations are done. Make sure te remove all spendable reservations for this ring
        for (i = 0; i < ring.size; i++) {
            ring.participations[i].order.resetReservations();
        }
    }

    function matchRing(
        Data.Participation memory buyer,
        Data.Participation memory seller
        )
        internal
        pure
        returns (uint)
    {
        if (buyer.fillAmountB < seller.fillAmountS) {
            // Amount seller wants less than amount maker sells
            seller.fillAmountS = buyer.fillAmountB;
            seller.fillAmountB = seller.fillAmountS.mul(seller.order.amountB) / seller.order.amountS;
        } else {
            buyer.fillAmountB = seller.fillAmountS;
            buyer.fillAmountS = buyer.fillAmountB.mul(buyer.order.amountS) / buyer.order.amountB;
        }

        require(buyer.fillAmountS >= seller.fillAmountB, "NOT-MATCHABLE");
        return buyer.fillAmountS.sub(seller.fillAmountB); // Return spread
    }

    function calculateOrderFillAmounts(
        Data.Context memory ctx,
        Data.Participation memory p,
        Data.Participation memory prevP,
        uint i,
        uint smallest
        )
        internal
        pure
        returns (uint smallest_)
    {
        // Default to the same smallest index
        smallest_ = smallest;

        uint postFeeFillAmountS = p.fillAmountS;
        uint tokenSFeePercentage = p.order.tokenSFeePercentage;
        if (tokenSFeePercentage > 0) {
            uint feeAmountS = p.fillAmountS.mul(tokenSFeePercentage) / ctx.feePercentageBase;
            postFeeFillAmountS = p.fillAmountS - feeAmountS;
        }

        if (prevP.fillAmountB > postFeeFillAmountS) {
            smallest_ = i;
            prevP.fillAmountB = postFeeFillAmountS;
            prevP.fillAmountS = postFeeFillAmountS.mul(prevP.order.amountS) / prevP.order.amountB;
        }
    }

    function checkOrdersValid(
        Data.Ring memory ring
        )
        internal
        pure
    {
        // NOTICE: deprecated logic, rings must be of size 2 now
        // ring.valid = ring.valid && (ring.size > 1 && ring.size <= 8); // invalid ring size
        
        ring.valid = ring.valid && ring.size == 2;

        // Ring must consist of a buy and a sell
        ring.valid = ring.valid && (
            (ring.participations[0].order.isBuy() && !ring.participations[1].order.isBuy()) ||
            (ring.participations[1].order.isBuy() && !ring.participations[0].order.isBuy())
        );

        for (uint i = 0; i < ring.size; i++) {
            uint prev = (i + ring.size - 1) % ring.size;
            ring.valid = ring.valid && ring.participations[i].order.valid;
            ring.valid = ring.valid && ring.participations[i].order.tokenS == ring.participations[prev].order.tokenB;
            ring.valid = ring.valid && !ring.participations[i].order.P2P; // No longer support P2P orders
        }
    }

    function checkForSubRings(
        Data.Ring memory ring
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size - 1; i++) {
            address tokenS = ring.participations[i].order.tokenS;
            for (uint j = i + 1; j < ring.size; j++) {
                ring.valid = ring.valid && (tokenS != ring.participations[j].order.tokenS);
            }
        }
    }

    function adjustOrderStates(
        Data.Ring memory ring
        )
        internal
        pure
    {
        // Adjust the orders
        for (uint i = 0; i < ring.size; i++) {
            ring.participations[i].adjustOrderState();
        }
    }


    function revertOrderStats(
        Data.Ring memory ring
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size; i++) {
            ring.participations[i].revertOrderState();
        }
    }

    function doPayments(
        Data.Ring memory ring,
        Data.Context memory ctx,
        Data.Mining memory mining
        )
        internal
    {
        payFees(ring, ctx, mining);
        transferTokens(ring, ctx, mining.feeRecipient);
    }

    function generateFills(
        Data.Ring memory ring,
        uint destPtr
        )
        internal
        pure
        returns (uint fill)
    {
        uint ringSize = ring.size;
        uint fillSize = 8 * 32;
        assembly {
            fill := destPtr
            let participations := mload(add(ring, 32))                                 // ring.participations

            for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                let participation := mload(add(participations, add(32, mul(i, 32))))   // participations[i]
                let order := mload(participation)                                      // participation.order

                // Calculate the actual fees paid after rebate
                let feeAmount := sub(
                    mload(add(participation, 64)),                                      // participation.feeAmount
                    mload(add(participation, 160))                                      // participation.rebateFee
                )
                let feeAmountS := sub(
                    mload(add(participation, 96)),                                      // participation.feeAmountS
                    mload(add(participation, 192))                                      // participation.rebateFeeS
                )
                let feeAmountB := sub(
                    mload(add(participation, 128)),                                     // participation.feeAmountB
                    mload(add(participation, 224))                                      // participation.rebateFeeB
                )

                mstore(add(fill,   0), mload(add(order, 864)))                         // order.hash
                mstore(add(fill,  32), mload(add(order,  32)))                         // order.owner
                mstore(add(fill,  64), mload(add(order,  64)))                         // order.tokenS
                mstore(add(fill,  96), mload(add(participation, 256)))                 // participation.fillAmountS
                mstore(add(fill, 128), mload(add(participation,  32)))                 // participation.splitS
                mstore(add(fill, 160), feeAmount)                                      // feeAmount
                mstore(add(fill, 192), feeAmountS)                                     // feeAmountS
                mstore(add(fill, 224), feeAmountB)                                     // feeAmountB

                fill := add(fill, fillSize)
            }
        }
    }

    function transferTokens(
        Data.Ring memory ring,
        Data.Context memory ctx,
        address feeRecipient
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size; i++) {
            transferTokensForParticipation(
                ctx,
                feeRecipient,
                ring.participations[i],
                ring.participations[(i + ring.size - 1) % ring.size]
            );
        }
    }

    function transferTokensForParticipation(
        Data.Context memory ctx,
        address feeRecipient,
        Data.Participation memory p,
        Data.Participation memory prevP
        )
        internal
        pure
        returns (uint)
    {
        // If the buyer needs to pay fees in tokenB, the seller needs
        // to send the tokenS amount to the fee holder contract
        uint amountSToBuyer = p.fillAmountS
            .sub(p.feeAmountS)
            .sub(prevP.feeAmountB.sub(prevP.rebateB)); // buyer fee amount after rebate

        uint amountSToFeeHolder = p.feeAmountS
            .sub(p.rebateS)
            .add(prevP.feeAmountB.sub(prevP.rebateB)); // buyer fee amount after rebate

        uint amountFeeToFeeHolder = p.feeAmount
            .sub(p.rebateFee);


        if (p.order.tokenS == p.order.feeToken) {
            amountSToFeeHolder = amountSToFeeHolder.add(amountFeeToFeeHolder);
            amountFeeToFeeHolder = 0;
        }

        // Transfers
        if (p.order.broker == address(0x0)) {
            ctx.transferPtr = addTokenTransfer(
                ctx.transferData,
                ctx.transferPtr,
                p.order.tokenS,
                p.order.owner,
                prevP.order.tokenRecipient,
                amountSToBuyer
            );

            ctx.transferPtr = addTokenTransfer(
                ctx.transferData,
                ctx.transferPtr,
                p.order.feeToken,
                p.order.owner,
                address(ctx.feeHolder),
                amountFeeToFeeHolder
            );

            ctx.transferPtr = addTokenTransfer(
                ctx.transferData,
                ctx.transferPtr,
                p.order.tokenS,
                p.order.owner,
                address(ctx.feeHolder),
                amountSToFeeHolder
            );
        } else {
            
            // Calculates amount received from other participant
            uint receivableAmountB = prevP.fillAmountS
                .sub(prevP.feeAmountS)
                .sub(p.feeAmountB.sub(p.rebateB)); // seller fee amount after rebate

            addBrokerTokenTransfer(
                ctx,
                p,
                receivableAmountB, // receivable amount incremented/set in called function for order
                p.order.tokenS,
                prevP.order.tokenRecipient,
                amountSToBuyer,
                false
            );

            addBrokerTokenTransfer(
                ctx,
                p,
                0, // receivable amount set to 0 for fee transfers
                p.order.feeToken,
                address(ctx.feeHolder),
                amountFeeToFeeHolder,
                true // this transfer concerns the fee token
            );

            addBrokerTokenTransfer(
                ctx,
                p,
                0, // receivable amount set to 0 for fee transfers
                p.order.tokenS,
                address(ctx.feeHolder),
                amountSToFeeHolder,
                false
            );
        }
        

        // NOTICE: Dolomite does not take the margin ever. We still track it for the order's history.
        // ctx.transferPtr = addTokenTransfer(
        //     ctx.transferData,
        //     ctx.transferPtr,
        //     p.order.tokenS,
        //     p.order.owner,
        //     feeRecipient,
        //     p.splitS
        // );
    }

    function addBrokerTokenTransfer(
        Data.Context memory ctx,
        Data.Participation memory participation,
        uint receivableAmount,
        address requestToken, 
        address recipient,
        uint requestAmount,
        bool isForFeeToken
    )
        internal
        pure
    {
        if (requestAmount > 0) {
            bytes32 actionHash = participation.order.getBrokerHash();
            bytes32 transferHash = keccak256(abi.encodePacked(actionHash, requestToken, recipient));
            
            Data.BrokerAction memory action;
            bool isActionNewlyCreated = false;

            uint index = 0;
            bool found = false;

            // Find a preexisting BrokerAction
            for (index = 0; index < ctx.numBrokerActions; index++) {
                if (ctx.brokerActions[index].hash == actionHash) {
                    action = ctx.brokerActions[index];
                    found = true;
                    break;
                }
            }

            // If none exist, create a new BrokerAction
            if (!found) {
                action = Data.BrokerAction({
                    hash: actionHash,
                    broker: participation.order.broker,
                    orderIndices: new uint[](ctx.brokerOrders.length),
                    numOrders: 0,
                    transferIndices: new uint[](ctx.brokerTransfers.length * 3),
                    numTransfers: 0,
                    tokenS: participation.order.tokenS,
                    tokenB: participation.order.tokenB,
                    feeToken: participation.order.feeToken
                });
                ctx.brokerActions[ctx.numBrokerActions] = action;
                ctx.numBrokerActions += 1;
                isActionNewlyCreated = true;
            } else {
                found = false;
            }

            // Find a preexisting BrokerOrder for the participant's order from those registered with the action
            if (!isActionNewlyCreated) {
                for (index = 0; index < action.numOrders; index++) {
                    if (ctx.brokerOrders[action.orderIndices[index]].orderHash == participation.order.hash) {
                        Data.BrokerOrder memory brokerOrder = ctx.brokerOrders[action.orderIndices[index]];
                        brokerOrder.fillAmountB += receivableAmount;
                        
                        if (isForFeeToken) {
                            brokerOrder.requestedFeeAmount += requestAmount;
                        } else {
                            brokerOrder.requestedAmountS += requestAmount;
                        }

                        found = true;
                        break;
                    }
                }
            }
            
            // If none exist, create a new BrokerOrder
            if (!found) {
                ctx.brokerOrders[ctx.numBrokerOrders] = Data.BrokerOrder({
                    owner: participation.order.owner,
                    orderHash: participation.order.hash,
                    fillAmountB: receivableAmount,
                    requestedAmountS: isForFeeToken ? 0 : requestAmount,
                    requestedFeeAmount: isForFeeToken ? requestAmount : 0,
                    tokenRecipient: participation.order.tokenRecipient,
                    extraData: participation.order.transferDataS
                });
                action.orderIndices[action.numOrders] = ctx.numBrokerOrders;
                action.numOrders += 1;
                ctx.numBrokerOrders += 1;
            } else {
                found = false;
            }

            // Find a preexisting BrokerTransfer from those registered with the action
            if (!isActionNewlyCreated) {
                for (index = 0; index < action.numTransfers; index++) {
                    if (ctx.brokerTransfers[action.transferIndices[index]].hash == transferHash) {
                        Data.BrokerTransfer memory transfer = ctx.brokerTransfers[action.transferIndices[index]];
                        transfer.amount += requestAmount;
                        found = true;
                        break;
                    }
                }
            }

            // If none exist, create a new BrokerTransfer
            if (!found) {
                ctx.brokerTransfers[ctx.numBrokerTransfers] = Data.BrokerTransfer(transferHash, requestToken, requestAmount, recipient);
                action.transferIndices[action.numTransfers] = ctx.numBrokerTransfers;
                action.numTransfers += 1;
                ctx.numBrokerTransfers += 1;
            }
        }
    }

    function addTokenTransfer(
        uint data,
        uint ptr,
        address token,
        address from,
        address to,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount > 0 && from != to) {
            assembly {
                // Try to find an existing fee payment of the same token to the same owner
                let addNew := 1
                for { let p := data } lt(p, ptr) { p := add(p, 128) } {
                    let dataToken := mload(add(p,  0))
                    let dataFrom := mload(add(p, 32))
                    let dataTo := mload(add(p, 64))
                    // if(token == dataToken && from == dataFrom && to == dataTo)
                    if and(and(eq(token, dataToken), eq(from, dataFrom)), eq(to, dataTo)) {
                        let dataAmount := mload(add(p, 96))
                        // dataAmount = amount.add(dataAmount);
                        dataAmount := add(amount, dataAmount)
                        // require(dataAmount >= amount) (safe math)
                        if lt(dataAmount, amount) {
                            revert(0, 0)
                        }
                        mstore(add(p, 96), dataAmount)
                        addNew := 0
                        // End the loop
                        p := ptr
                    }
                }
                // Add a new transfer
                if eq(addNew, 1) {
                    mstore(add(ptr,  0), token)
                    mstore(add(ptr, 32), from)
                    mstore(add(ptr, 64), to)
                    mstore(add(ptr, 96), amount)
                    ptr := add(ptr, 128)
                }
            }
            return ptr;
        } else {
            return ptr;
        }
    }

    function payFees(
        Data.Ring memory ring,
        Data.Context memory ctx,
        Data.Mining memory mining
        )
        internal
    {
        Data.FeeContext memory feeCtx;
        feeCtx.ring = ring;
        feeCtx.ctx = ctx;
        feeCtx.feeRecipient = mining.feeRecipient;
        for (uint i = 0; i < ring.size; i++) {
            payFeesForParticipation(
                feeCtx,
                ring.participations[i]
            );
        }
    }

    function payFeesForParticipation(
        Data.FeeContext memory feeCtx,
        Data.Participation memory p
        )
        internal
        returns (uint)
    {
        feeCtx.walletPercentage = p.order.P2P ? 100 : (
            (p.order.wallet == address(0x0) ? 0 : p.order.walletSplitPercentage)
        );
        feeCtx.waiveFeePercentage = p.order.waiveFeePercentage;
        feeCtx.owner = p.order.owner;
        feeCtx.wallet = p.order.wallet;
        feeCtx.P2P = p.order.P2P;

        p.rebateFee = payFeesAndBurn(
            feeCtx,
            p.order.feeToken,
            p.feeAmount
        );
        p.rebateS = payFeesAndBurn(
            feeCtx,
            p.order.tokenS,
            p.feeAmountS
        );
        p.rebateB = payFeesAndBurn(
            feeCtx,
            p.order.tokenB,
            p.feeAmountB
        );
    }

    function payFeesAndBurn(
        Data.FeeContext memory feeCtx,
        address token,
        uint totalAmount
        )
        internal
        returns (uint)
    {
        if (totalAmount == 0) {
            return 0;
        }

        uint amount = totalAmount;
        // No need to pay any fees in a P2P order without a wallet
        // (but the fee amount is a part of amountS of the order, so the fee amount is rebated).
        if (feeCtx.P2P && feeCtx.wallet == address(0x0)) {
            amount = 0;
        }

        uint feeToWallet = 0;
        uint minerFee = 0;
        uint minerFeeBurn = 0;
        uint walletFeeBurn = 0;
        if (amount > 0) {
            feeToWallet = amount.mul(feeCtx.walletPercentage) / 100;
            minerFee = amount - feeToWallet;

            // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
            if (feeCtx.waiveFeePercentage > 0) {
                minerFee = minerFee.mul(
                    feeCtx.ctx.feePercentageBase - uint(feeCtx.waiveFeePercentage)) /
                    feeCtx.ctx.feePercentageBase;
            } else if (feeCtx.waiveFeePercentage < 0) {
                // No fees need to be paid by this order
                minerFee = 0;
            }

            uint32 burnRate = getBurnRate(feeCtx, token);
            assert(burnRate <= feeCtx.ctx.feePercentageBase);

            // Miner fee
            minerFeeBurn = minerFee.mul(burnRate) / feeCtx.ctx.feePercentageBase;
            minerFee = minerFee - minerFeeBurn;
            // Wallet fee
            walletFeeBurn = feeToWallet.mul(burnRate) / feeCtx.ctx.feePercentageBase;
            feeToWallet = feeToWallet - walletFeeBurn;

            // Pay the wallet
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                feeCtx.wallet,
                feeToWallet
            );

            // Pay the burn rate with the feeHolder as owner
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                address(feeCtx.ctx.feeHolder),
                minerFeeBurn + walletFeeBurn
            );

            // Fees can be paid out in different tokens so we can't easily accumulate the total fee
            // that needs to be paid out to order owners. So we pay out each part out here to all
            // orders that need it.
            uint feeToMiner = minerFee;
            if (feeCtx.ring.minerFeesToOrdersPercentage > 0 && minerFee > 0) {
                // Pay out the fees to the orders
                distributeMinerFeeToOwners(
                    feeCtx,
                    token,
                    minerFee
                );
                // Subtract all fees the miner pays to the orders
                feeToMiner = minerFee.mul(feeCtx.ctx.feePercentageBase -
                    feeCtx.ring.minerFeesToOrdersPercentage) /
                    feeCtx.ctx.feePercentageBase;
            }

            // Pay the miner
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                feeCtx.feeRecipient,
                feeToMiner
            );
        }

        // Calculate the total fee payment after possible discounts (burn rebate + fee waiving)
        // and return the total rebate
        return totalAmount.sub((feeToWallet + minerFee) + (minerFeeBurn + walletFeeBurn));
    }

    function getBurnRate(
        Data.FeeContext memory feeCtx,
        address token
        )
        internal
        view
        returns (uint32)
    {
        bytes32[] memory tokenBurnRates = feeCtx.ctx.tokenBurnRates;
        uint length = tokenBurnRates.length;
        for (uint i = 0; i < length; i += 2) {
            if (token == address(bytes20(tokenBurnRates[i]))) {
                uint32 burnRate = uint32(bytes4(tokenBurnRates[i + 1]));
                return feeCtx.P2P ? (burnRate / 0x10000) : (burnRate & 0xFFFF);
            }
        }
        // Not found, add it to the list
        uint32 burnRate = feeCtx.ctx.burnRateTable.getBurnRate(token);
        assembly {
            let ptr := add(tokenBurnRates, mul(add(1, length), 32))
            mstore(ptr, token)                              // token
            mstore(add(ptr, 32), burnRate)                  // burn rate
            mstore(tokenBurnRates, add(length, 2))          // length
        }
        return feeCtx.P2P ? (burnRate / 0x10000) : (burnRate & 0xFFFF);
    }

    function distributeMinerFeeToOwners(
        Data.FeeContext memory feeCtx,
        address token,
        uint minerFee
        )
        internal
    {
        for (uint i = 0; i < feeCtx.ring.size; i++) {
            if (feeCtx.ring.participations[i].order.waiveFeePercentage < 0) {
                uint feeToOwner = minerFee
                    .mul(uint(-feeCtx.ring.participations[i].order.waiveFeePercentage)) / feeCtx.ctx.feePercentageBase;

                emit DistributeFeeRebate(feeCtx.ring.hash, feeCtx.ring.participations[i].order.hash, token, feeToOwner);

                feeCtx.ctx.feePtr = addFeePayment(
                    feeCtx.ctx.feeData,
                    feeCtx.ctx.feePtr,
                    token,
                    feeCtx.ring.participations[i].order.owner,
                    feeToOwner);
            }
        }
    }

    function addFeePayment(
        uint data,
        uint ptr,
        address token,
        address owner,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return ptr;
        } else {
            assembly {
                // Try to find an existing fee payment of the same token to the same owner
                let addNew := 1
                for { let p := data } lt(p, ptr) { p := add(p, 96) } {
                    let dataToken := mload(add(p,  0))
                    let dataOwner := mload(add(p, 32))
                    // if(token == dataToken && owner == dataOwner)
                    if and(eq(token, dataToken), eq(owner, dataOwner)) {
                        let dataAmount := mload(add(p, 64))
                        // dataAmount = amount.add(dataAmount);
                        dataAmount := add(amount, dataAmount)
                        // require(dataAmount >= amount) (safe math)
                        if lt(dataAmount, amount) {
                            revert(0, 0)
                        }
                        mstore(add(p, 64), dataAmount)
                        addNew := 0
                        // End the loop
                        p := ptr
                    }
                }
                // Add a new fee payment
                if eq(addNew, 1) {
                    mstore(add(ptr,  0), token)
                    mstore(add(ptr, 32), owner)
                    mstore(add(ptr, 64), amount)
                    ptr := add(ptr, 96)
                }
            }
            return ptr;
        }
    }

}
