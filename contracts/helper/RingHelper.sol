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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/IExchange.sol";
import "../impl/BrokerInterceptorProxy.sol";
import "../impl/Data.sol";
import "../lib/MathUint.sol";
import "../lib/ERC20.sol";
import "../lib/MultihashUtil.sol";
import "./ParticipationHelper.sol";


/// @title An Implementation of IOrderbook.
library RingHelper {
    using MathUint for uint;
    using ParticipationHelper for Data.Participation;
    using BrokerInterceptorProxy for address;

    uint private constant DUST = 1000; // if a transfer's amount < 1000, ignore it.

    enum TokenType { LRC, ETH, Other }

    function updateHash(
        Data.Ring ring
        )
        internal
        pure
    {
        bytes memory orderHashes = new bytes(32 * ring.size);
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            bytes32 orderHash = p.order.hash;
            assembly {
                 mstore(add(add(orderHashes, 0x20), mul(i, 0x20)), orderHash)
            }
        }
        ring.hash = keccak256(orderHashes);
    }

    function calculateFillAmountAndFee(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
        pure
    {
        uint i;
        for (i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            Data.Order memory order = p.order;
            p.fillAmountS = order.maxAmountS;
            if (ring.P2P) {
                // If this is a P2P ring we may have to pay a (pre-trading) percentage tokenS to the wallet
                // We have to make sure the order owner can pay that percentage, otherwise we'll have to sell
                // less tokenS. We have to calculate totalAmountS here so that
                // fillAmountS := totalAmountS - (totalAmountS * tokenSFeePercentage)
                uint totalAmountS = p.fillAmountS.mul(1000) / (1000 - p.order.tokenSFeePercentage);
                if (totalAmountS > p.order.spendableS) {
                    uint maxFeeAmountS = order.spendableS.mul(order.tokenSFeePercentage) / 1000;
                    p.fillAmountS = p.order.spendableS - maxFeeAmountS;
                }
            }
            p.fillAmountB = p.fillAmountS.mul(order.amountB) / order.amountS;
        }

        uint smallest = 0;
        for (i = ring.size - 1; i >= 0; i--) {
            smallest = calculateOrderFillAmounts(ring, i, smallest);
            if (i == 0) { // when i == 0, i-- will becomes the MAX_VALUE.
                break;
            }
        }
        for (i = ring.size - 1; i >= smallest; i--) {
            calculateOrderFillAmounts(ring, i, smallest);
            if (i == smallest) {
                break;
            }
        }

        uint nextIndex = 0;
        for (i = 0; i < ring.size; i++) {
            nextIndex = (i + 1) % ring.size;
            Data.Participation memory p = ring.participations[i];
            Data.Participation memory nextP = ring.participations[nextIndex];
            if (nextP.fillAmountS >= p.fillAmountB) {
                calculateOrderFees(ring, ctx, p, nextP);
            } else {
                ring.valid = false;
                break;
            }
        }

        if (ring.valid) {
            for (i = 0; i < ring.size; i++) {
                Data.Participation memory p = ring.participations[i];
                p.adjustOrderState();
            }
        }
    }

    function calculateOrderFees(
        Data.Ring ring,
        Data.Context ctx,
        Data.Participation p,
        Data.Participation nextP
        )
        internal
        pure
    {
        if (ring.P2P) {
            // Calculate P2P fees
            nextP.feeAmount = 0;
            if (nextP.order.wallet != 0x0) {
                nextP.feeAmountS = nextP.fillAmountS.mul(
                    1000) / (1000 - nextP.order.tokenSFeePercentage) - nextP.fillAmountS;
                nextP.feeAmountB = nextP.fillAmountB.mul(nextP.order.tokenBFeePercentage) / 1000;
            } else {
                nextP.feeAmountS = 0;
                nextP.feeAmountB = 0;
            }

            // The taker gets the margin
            nextP.splitS = 0;
        } else {
            // Calculate matching fees
            nextP.feeAmount = nextP.order.feeAmount * nextP.fillAmountS / nextP.order.amountS;
            nextP.feeAmountS = 0;
            nextP.feeAmountB = 0;

            // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
            uint feeTaxRate = getTaxRate(ctx, nextP.order.feeToken, false, ring.P2P);
            uint feeAmountTax = nextP.feeAmount.mul(feeTaxRate) / 1000;
            uint totalAmountFeeToken = nextP.feeAmount + feeAmountTax;
            if (nextP.order.feeToken == nextP.order.tokenS) {
                totalAmountFeeToken += nextP.fillAmountS;
            }
            if (totalAmountFeeToken > nextP.order.spendableFee) {
                nextP.feeAmountB = nextP.fillAmountB.mul(nextP.order.feePercentage) / 1000;
                nextP.feeAmount = 0;
            }

            // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
            if (nextP.order.waiveFeePercentage > 0) {
                uint waiveFeePercentage = uint(nextP.order.waiveFeePercentage);
                nextP.feeAmount = nextP.feeAmount.mul(1000 - waiveFeePercentage) / 1000;
                nextP.feeAmountB = nextP.feeAmountB.mul(1000 - waiveFeePercentage) / 1000;
                // fillAmountFeeS is always 0
            } else if (nextP.order.waiveFeePercentage < 0) {
                ring.minerFeesToOrdersPercentage += uint(-nextP.order.waiveFeePercentage);
                // No fees need to be paid by this order
                nextP.feeAmount = 0;
                nextP.feeAmountB = 0;
            }

            // The miner/wallet gets the margin
            nextP.splitS = nextP.fillAmountS - p.fillAmountB;
            nextP.fillAmountS = p.fillAmountB;
        }

        // Calculate consumer taxes. These are applied on top of the calculated fees
        uint feeTokenRate = getTaxRate(ctx, nextP.order.feeToken, false, ring.P2P);
        nextP.taxFee = nextP.feeAmount.mul(feeTokenRate) / 1000;
        uint tokenSRate = getTaxRate(ctx, nextP.order.tokenS, false, ring.P2P);
        nextP.taxS = nextP.feeAmountS.mul(tokenSRate) / 1000;
        uint tokenBRate = getTaxRate(ctx, nextP.order.tokenB, false, ring.P2P);
        nextP.taxB = nextP.feeAmountB.mul(tokenBRate) / 1000;
    }

    function calculateOrderFillAmounts(
        Data.Ring ring,
        uint i,
        uint smallest
        )
        internal
        pure
        returns (uint smallest_)
    {
        // Default to the same smallest index
        smallest_ = smallest;

        Data.Participation memory p = ring.participations[i];
        uint j = (i + ring.size - 1) % ring.size;
        Data.Participation memory prevP = ring.participations[j];
        if (prevP.fillAmountB > p.fillAmountS) {
            smallest_ = i;
            prevP.fillAmountB = p.fillAmountS;
            prevP.fillAmountS = prevP.fillAmountB.mul(prevP.order.amountS) / prevP.order.amountB;
        }
    }

    function checkOrdersValid(
        Data.Ring ring
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            ring.valid = ring.valid && p.order.valid;
        }
    }

    function checkTokensRegistered(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
        view
    {
        // Extract the token addresses
        address[] memory tokens = new address[](ring.size);
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            tokens[i] = p.order.tokenS;
        }

        // Test all token addresses at once
        ring.valid = ring.valid && ctx.tokenRegistry.areAllTokensRegistered(tokens);
    }

    function checkP2P(
        Data.Ring ring,
        Data.Mining mining
        )
        internal
        pure
    {
        // This is a P2P ring when the signer of the ring is an owner of an order in the ring
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            if (p.order.owner == mining.miner) {
                ring.P2P = true;
                return;
            }
        }
    }

    /*function calculateTransferBatchSize(
        Data.Ring ring,
        uint8 walletSplitPercentage
        )
        internal
        pure
        returns (uint batchSize, uint feeTransSize)
    {
        uint orderFeeTransSize;
        for (uint i = 0; i < ring.size; i++) {
            orderFeeTransSize = 0;
            Data.Participation memory p = ring.participations[i];
            Data.Participation memory prevP = ring.participations[(i + ring.size - 1) % ring.size];

            // If the buyer needs to pay fees in tokenB, the seller needs
            // to send the tokenS amount to the fee holder contract
            uint amountSToBuyer = p.fillAmountS.sub(prevP.feeAmountB);
            uint amountSToFeeHolder = p.splitS.add(p.feeAmountS).add(prevP.feeAmountB);
            uint amountFeeToFeeHolder = p.feeAmount;
            if (p.order.tokenS == p.order.feeToken) {
                amountSToFeeHolder += amountFeeToFeeHolder;
                amountFeeToFeeHolder = 0;
            }

            // Transfers
            if (amountSToBuyer > 0) {
                batchSize++;
            }
            if (amountSToFeeHolder > 0) {
                batchSize++;
            }
            if (amountFeeToFeeHolder > 0) {
                batchSize++;
            }

            if (p.feeAmount > 0) {
                feeTransSize++;
            }
            if (p.feeAmountB > 0) {
                feeTransSize++;
            }
            if (p.feeAmountS > 0) {
                feeTransSize++;
            }
            if (p.splitS > 0) {
                feeTransSize++;
            }

            uint8 walletPercentage = (p.order.wallet != 0x0) ? walletSplitPercentage : uint8(0);
            if (ring.P2P) {
                // Miner gets nothing
                walletPercentage = uint8(100);
            }
            if (walletPercentage > 0 && walletPercentage < 100) {
                feeTransSize *= 2;
            }
        }
    }*/

    event LogTrans(address token, address from, address to, uint amount, uint spendable);
    function settleRing(Data.Ring ring, Data.Context ctx, Data.Mining mining)
        internal
        // returns (IExchange.Fill[] memory fills)
    {
        doTokenTransfers(ring, ctx);
        doFeePayments(ring, ctx, mining);


        /*uint batchSize;
        uint feeTransSize;
        uint8 walletSplitPercentage = ctx.delegate.walletSplitPercentage();
        (batchSize, feeTransSize) = calculateTransferBatchSize(ring, walletSplitPercentage);

        bytes32[] memory batch;
        (/*fills, *//*batch) = generateBatchTransferData(ring, address(ctx.feeHolder), batchSize);
        // logTrans(batch, address(ctx.delegate));
        ctx.delegate.batchTransfer(batch);

        bytes32[] memory feeTransInfo;
        feeTransInfo = generateBatchFeeInfos(
            ring,
            mining,
            feeTransSize,
            walletSplitPercentage
        );
        ctx.feeHolder.batchAddFeeBalances(feeTransInfo);*/

        /* for (i = 0; i < ring.size; i++) { */
        /*     p = ring.participations[i]; */
        /*     if (p.order.brokerInterceptor != 0x0) { */
        /*         p.order.brokerInterceptor.onTokenSpentSafe( */
        /*             p.order.owner, */
        /*             p.order.broker, */
        /*             p.order.tokenS, */
        /*             p.fillAmountS */
        /*         ); */
        /*         // Might want to add LRC and/or other fee payment here as well */
        /*     } */
        /* } */
    }

    /*function generateBatchFeeInfos(
        Data.Ring ring,
        Data.Mining mining,
        uint feeTransSize,
        uint8 walletSplitPercentage)
        internal
        pure
        returns (bytes32[] memory feeInfoBatch)
    {
        feeInfoBatch = new bytes32[](feeTransSize * 3);
        uint batchIndex = 0;
        uint walletFee;
        uint minerFee;
        uint8 walletPercentage;
        Data.Participation memory p;
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];

            walletPercentage = (p.order.wallet != 0x0) ? walletSplitPercentage : uint8(0);
            if (ring.P2P) {
                // Miner gets nothing
                walletPercentage = uint8(100);
            }
            if (p.feeAmount > 0) {
                walletFee = p.feeAmount.mul(walletPercentage) / 100;
                minerFee = p.feeAmount.sub(walletFee);
                if (walletFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.feeToken);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex++;
                }
                if (minerFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.feeToken);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(minerFee);
                    batchIndex++;
                }
            }
            if (p.feeAmountB > 0) {
                walletFee = p.feeAmountB.mul(walletPercentage) / 100;
                minerFee = p.feeAmountB.sub(walletFee);
                if (walletFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenB);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex++;
                }
                if (minerFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenB);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(minerFee);
                    batchIndex++;
                }
            }
            if (p.feeAmountS > 0) {
                walletFee = p.feeAmountS.mul(walletPercentage) / 100;
                minerFee = p.feeAmountS.sub(walletFee);
                if (walletFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex++;
                }
                if (minerFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(minerFee);
                    batchIndex++;
                }
            }
            if (p.splitS > 0) {
                walletFee = p.splitS.mul(walletPercentage) / 100;
                minerFee = p.splitS.sub(walletFee);
                if (walletFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex++;
                }
                if (minerFee > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(minerFee);
                    batchIndex++;
                }
            }
        }

        return feeInfoBatch;
    }*/

    /*function generateBatchTransferData(
        Data.Ring ring,
        address feeHolder,
        uint batchSize)
        internal
        // pure
        returns (/*IExchange.Fill[],*//* bytes32[])
    {
        //IExchange.Fill[] memory fills = new IExchange.Fill[](ring.size);

        bytes32[] memory batch = new bytes32[](batchSize * 4);
        uint batchIndex = 0;
        uint i;
        Data.Participation memory p;
        Data.Participation memory prevP;
        uint amountSToBuyer;
        uint amountSToFeeHolder;
        uint amountFeeToFeeHolder;
        for (i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            prevP = ring.participations[(i + ring.size - 1) % ring.size];

            /*fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS;
            fills[i].feeAmount = p.feeAmount;*/

            // If the buyer needs to pay fees in tokenB, the seller needs
            // to send the tokenS amount to the fee holder contract
            /*amountSToBuyer = p.fillAmountS.sub(prevP.feeAmountB);
            amountSToFeeHolder = p.splitS.add(p.feeAmountS).add(prevP.feeAmountB);
            amountFeeToFeeHolder = p.feeAmount;
            if (p.order.tokenS == p.order.feeToken) {
                amountSToFeeHolder += amountFeeToFeeHolder;
                amountFeeToFeeHolder = 0;
            }

            // Transfers
            if (amountSToBuyer > 0) {
                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(prevP.order.owner);
                batch[3 + batchIndex * 4] = bytes32(amountSToBuyer);
                batchIndex++;
            }
            if (amountSToFeeHolder > 0) {
                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(feeHolder);
                batch[3 + batchIndex * 4] = bytes32(amountSToFeeHolder);
                batchIndex++;
            }
            if (amountFeeToFeeHolder > 0) {
                batch[0 + batchIndex * 4] = bytes32(p.order.feeToken);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(feeHolder);
                batch[3 + batchIndex * 4] = bytes32(amountFeeToFeeHolder);
                batchIndex++;
            }
        }

        return (/*fills, *//*batch);
    }*/


    function doTokenTransfers(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
        // returns (IExchange.Fill[])
    {
        //IExchange.Fill[] memory fills = new IExchange.Fill[](ring.size);

        // Maximum number of transfers for now. Will fix this using assembly.
        // (in assembly we don't need to specify the size of the array, we can just fetch
        // the free memory pointer and start storing data)
        bytes32[] memory data = new bytes32[](ring.size * 3 * 4);
        uint offset = 0;
        Data.Participation memory p;
        Data.Participation memory prevP;
        uint amountSToBuyer;
        uint amountSToFeeHolder;
        uint amountFeeToFeeHolder;
        address feeHolder = address(ctx.feeHolder);
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            prevP = ring.participations[(i + ring.size - 1) % ring.size];

            /*fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS;
            fills[i].feeAmount = p.feeAmount;*/

            // If the buyer needs to pay fees in tokenB, the seller needs
            // to send the tokenS amount to the fee holder contract
            amountSToBuyer = p.fillAmountS.sub(prevP.feeAmountB).sub(prevP.taxB);
            amountSToFeeHolder = p.splitS.add(p.feeAmountS).add(p.taxS).add(prevP.feeAmountB).add(prevP.taxB);
            amountFeeToFeeHolder = p.feeAmount + p.taxFee;
            if (p.order.tokenS == p.order.feeToken) {
                amountSToFeeHolder += amountFeeToFeeHolder;
                amountFeeToFeeHolder = 0;
            }

            // Transfers
            offset = addTokenTransfer(data, offset, p.order.tokenS, p.order.owner, prevP.order.owner, amountSToBuyer);
            offset = addTokenTransfer(data, offset, p.order.tokenS, p.order.owner, feeHolder, amountSToFeeHolder);
            offset = addTokenTransfer(data, offset, p.order.feeToken, p.order.owner, feeHolder, amountFeeToFeeHolder);
        }
        // For now, just patch the length so that the data is in the expected format
        assembly {
            mstore(data, offset)
        }
        ctx.delegate.batchTransfer(data);
    }

    function addTokenTransfer(bytes32[] data, uint offset, address token, address from, address to, uint amount)
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return offset;
        } else {
            data[0 + offset] = bytes32(token);
            data[1 + offset] = bytes32(from);
            data[2 + offset] = bytes32(to);
            data[3 + offset] = bytes32(amount);
            return offset + 4;
        }
    }

    function doFeePayments(
        Data.Ring ring,
        Data.Context ctx,
        Data.Mining mining
        )
        internal
    {
        // Large number of fee payments for now. Will fix this using assembly.
        // (in assembly we don't need to specify the size of the array, we can just fetch
        // the free memory pointer and start storing data)
        bytes32[] memory data = new bytes32[](ring.size * 3 * 9);
        uint8 walletSplitPercentage = ring.P2P ? 100 : ctx.delegate.walletSplitPercentage();

        Data.FeeContext memory feeCtx = Data.FeeContext(
            data,
            0,
            ring,
            ctx,
            mining,
            walletSplitPercentage
        );

        Data.Participation memory p;
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            uint feeInTokenS = p.feeAmountS + p.splitS;
            payFeesAndTaxes(feeCtx, p.order.feeToken, p.feeAmount, p.taxFee, p.order.wallet);
            payFeesAndTaxes(feeCtx, p.order.tokenS, feeInTokenS, p.taxS, p.order.wallet);
            payFeesAndTaxes(feeCtx, p.order.tokenB, p.feeAmountB, p.taxB, p.order.wallet);
        }
        // For now, just patch the length so that the data is in the expected format
        uint offset = feeCtx.offset;
        assembly {
            mstore(data, offset)
        }
        ctx.feeHolder.batchAddFeeBalances(data);
    }

    function payFeesAndTaxes(
        Data.FeeContext memory feeCtx,
        address token,
        uint amount,
        uint consumerTax,
        address wallet
        )
        internal
        pure
    {
        if (amount == 0) {
            return;
        }

        uint incomeTaxRate = getTaxRate(feeCtx.ctx, token, true, feeCtx.ring.P2P);
        uint incomeTax = amount.mul(incomeTaxRate) / 1000;
        uint incomeAfterTax = amount - incomeTax;

        uint feeToWallet = 0;
        if (wallet != 0x0) {
            feeToWallet = incomeAfterTax.mul(feeCtx.walletSplitPercentage) / 100;
        }
        uint minerFee = incomeAfterTax - feeToWallet;
        if (feeCtx.ring.P2P) {
            minerFee = 0;
        }

        uint feeToMiner = minerFee;
        // Fees can be paid out in different tokens so we can't easily accumulate the total fee
        // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
        if (feeCtx.ring.minerFeesToOrdersPercentage > 0) {
            // Subtract all fees the miner pays to the orders
            feeToMiner = minerFee.mul(1000 - feeCtx.ring.minerFeesToOrdersPercentage) / 1000;
            // Pay out the fees to the orders
            distributeMinerFeeToOwners(feeCtx, token, feeToMiner);
        }
        feeCtx.offset = payFee(feeCtx.data, feeCtx.offset, token, wallet, feeToWallet);
        feeCtx.offset = payFee(feeCtx.data, feeCtx.offset, token, feeCtx.mining.feeRecipient, feeToMiner);
        // Pay the tax with the feeHolder as owner
        feeCtx.offset = payFee(
            feeCtx.data, feeCtx.offset, token, address(feeCtx.ctx.feeHolder), consumerTax + incomeTax
        );
    }

    function distributeMinerFeeToOwners(Data.FeeContext memory feeCtx, address token, uint minerFee)
        internal
        pure
    {
        for (uint i = 0; i < feeCtx.ring.size; i++) {
            Data.Participation memory p = feeCtx.ring.participations[i];
            if (p.order.waiveFeePercentage < 0) {
                uint feeToOwner = minerFee.mul(uint(-p.order.waiveFeePercentage)) / 1000;
                feeCtx.offset = payFee(feeCtx.data, feeCtx.offset, token, p.order.owner, feeToOwner);
            }
        }
    }

    function payFee(bytes32[] data, uint offset, address token, address owner, uint amount)
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return offset;
        } else {
            data[0 + offset] = bytes32(token);
            data[1 + offset] = bytes32(owner);
            data[2 + offset] = bytes32(amount);
            return offset + 3;
        }
    }

    function getTokenType(Data.Context ctx, address token)
        internal
        pure
        returns (TokenType)
    {
        if (token == ctx.lrcTokenAddress) {
            return TokenType.LRC;
        } else if (token == ctx.wethTokenAddress) {
            return TokenType.ETH;
        } else {
            return TokenType.Other;
        }
    }

    function getTaxRate(Data.Context ctx, address token, bool income, bool P2P)
        internal
        pure
        returns (uint)
    {
        TokenType tokenType = getTokenType(ctx, token);
        if (P2P) {
            if (income) {
                uint[3] memory taxes = [uint(0), 0, 0];
                return taxes[uint(tokenType)];
            } else {
                uint[3] memory taxes = [uint(10), 20, 20];
                return taxes[uint(tokenType)];
            }
        } else {
            if (income) {
                uint[3] memory taxes = [uint(10), 100, 200];
                return taxes[uint(tokenType)];
            } else {
                uint[3] memory taxes = [uint(10), 500, 1000];
                return taxes[uint(tokenType)];
            }
        }
    }

    function logTrans(bytes32[] batch, address delegateAddress)
        internal
    {
        for (uint i = 0; i < batch.length; i += 4) {
            uint spendable = getSpendable(
                address(batch[i]),
                address(batch[i + 1]),
                delegateAddress
            );
            emit LogTrans(
                address(batch[i]),
                address(batch[i + 1]),
                address(batch[i + 2]),
                uint(batch[i + 3]),
                spendable
            );
        }
    }

    function getSpendable(
        address token,
        address owner,
        address spender)
        internal
        view
        returns (uint amount)
    {
        uint allowance = ERC20(token).allowance(owner, spender);
        uint balance = ERC20(token).balanceOf(owner);
        if (balance > allowance) {
            amount = allowance;
        } else {
            amount = balance;
        }
    }

    /* function batchUpdateOrderFillAmount(Data.Ring ring, Data.Context ctx) */
    /*     internal */
    /* { */

    /* } */
}
