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
        Data.Mining mining
        )
        internal
        pure
    {
        uint i;
        for (i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            Data.Order memory order = p.order;
            p.fillAmountS = order.maxAmountS;
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
                nextP.feeAmount = nextP.order.feeAmount.mul(nextP.fillAmountS) / nextP.order.amountS;
                if (ring.P2P) {
                    // TODO: tokenS is pre-trading so we'll probably have to scale the ring
                    // keeping this percentage in mind.
                    // If we do a simple percentage on top of fillAmountS we could go above spendableS
                    nextP.tokenSFeePercentage = nextP.order.tokenSFeePercentage;
                    nextP.tokenBFeePercentage = nextP.order.tokenBFeePercentage;
                }
                // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
                uint totalAmountFeeToken = nextP.feeAmount;
                if (nextP.order.feeToken == nextP.order.tokenS) {
                    totalAmountFeeToken = totalAmountFeeToken.add(nextP.fillAmountS);
                }
                if (totalAmountFeeToken > nextP.order.spendableFee) {
                    // TODO: safe math for uint16
                    nextP.tokenBFeePercentage += nextP.order.feePercentage;
                    nextP.feeAmount = 0;
                }

                nextP.splitS = nextP.fillAmountS - p.fillAmountB;
                nextP.fillAmountS = p.fillAmountB;
            } else {
                ring.valid = false;
                break;
            }
            // p.calculateFeeAmounts(mining);
        }

        if (ring.valid) {
            for (i = 0; i < ring.size; i++) {
                Data.Participation memory p = ring.participations[i];
                p.adjustOrderState();
            }
        }
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

    function calculateTransferBatchSize(
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

            if (p.splitS > 0) {
                orderFeeTransSize ++;
            }

            if (p.feeAmount > 0) {
                orderFeeTransSize ++;
            }

            if (p.tokenBFeePercentage > 0) {
                orderFeeTransSize ++;
            }

            batchSize += orderFeeTransSize;
            batchSize += 1; // order trade transfer.

            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                orderFeeTransSize = orderFeeTransSize * 2;
            }
            feeTransSize += orderFeeTransSize;
        }
    }

    event LogTrans(address token, address from, address to, uint amount, uint spendable);
    function settleRing(Data.Ring ring, Data.Context ctx, Data.Mining mining)
        internal
        returns (IExchange.Fill[] memory fills)
    {
        uint batchSize;
        uint feeTransSize;
        uint8 walletSplitPercentage = ctx.delegate.walletSplitPercentage();
        (batchSize, feeTransSize) = calculateTransferBatchSize(ring, walletSplitPercentage);

        bytes32[] memory batch;
        (fills, batch) = generateBatchTransferData(ring, ctx, batchSize);
        // logTrans(batch, address(ctx.delegate));
        ctx.delegate.batchTransfer(batch);

        bytes32[] memory feeTransInfo;
        feeTransInfo = generateBatchFeeInfos(
            ring,
            mining,
            feeTransSize,
            walletSplitPercentage
        );
        ctx.feeHolder.batchAddFeeBalances(feeTransInfo);

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

    function generateBatchFeeInfos(
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
        Data.Participation memory p;
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                if (p.feeAmount > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.feeToken);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    uint walletFee = p.feeAmount.mul(walletSplitPercentage) / 100;
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex ++;

                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.feeToken);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(p.feeAmount.sub(walletFee));
                    batchIndex ++;
                }

                if (p.tokenBFeePercentage > 0) {
                    uint feeAmountB = p.fillAmountB.mul(p.tokenBFeePercentage) / 1000;

                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenB);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    uint walletFee = feeAmountB.mul(walletSplitPercentage) / 100;
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletFee);
                    batchIndex ++;

                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenB);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(feeAmountB.sub(walletFee));
                    batchIndex ++;
                }

                if (p.splitS > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(p.order.wallet);
                    uint walletSplitS = p.splitS.mul(walletSplitPercentage) / 100;
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(walletSplitS);
                    batchIndex ++;

                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(p.splitS.sub(walletSplitS));
                    batchIndex ++;
                }
            } else {
                if (p.feeAmount > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.feeToken);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(p.feeAmount);
                    batchIndex += 1;
                }

                if (p.tokenBFeePercentage > 0) {
                    uint feeAmountB = p.fillAmountB.mul(p.tokenBFeePercentage) / 1000;
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenB);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(feeAmountB);
                    batchIndex ++;
                }

                if (p.splitS > 0) {
                    feeInfoBatch[0 + batchIndex * 3] = bytes32(p.order.tokenS);
                    feeInfoBatch[1 + batchIndex * 3] = bytes32(mining.feeRecipient);
                    feeInfoBatch[2 + batchIndex * 3] = bytes32(p.splitS);
                    batchIndex ++;
                }
            }
        }

        return feeInfoBatch;
    }

    function generateBatchTransferData(
        Data.Ring ring,
        Data.Context ctx,
        uint batchSize)
        internal
        pure
        returns (IExchange.Fill[], bytes32[])
    {
        IExchange.Fill[] memory fills = new IExchange.Fill[](ring.size);

        bytes32[] memory batch = new bytes32[](batchSize * 4);
        uint batchIndex = 0;
        uint i;
        uint prevIndex;
        Data.Participation memory p;
        Data.Participation memory prevP;
        for (i = 0; i < ring.size; i++) {
            prevIndex = (i + ring.size - 1) % ring.size;
            p = ring.participations[i];
            prevP = ring.participations[prevIndex];

            fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS;
            fills[i].feeAmount = p.feeAmount;

            // If the buyer needs to pay fees in tokenB, the seller needs
            // to send the tokenS amount to the fee holder contract
            if (prevP.tokenBFeePercentage > 0) {
                uint feeAmountB = p.fillAmountS.mul(prevP.tokenBFeePercentage) / 1000;

                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(address(ctx.feeHolder));
                batch[3 + batchIndex * 4] = bytes32(feeAmountB);
                batchIndex ++;

                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(prevP.order.owner);
                batch[3 + batchIndex * 4] = bytes32(p.fillAmountS.sub(feeAmountB));
                batchIndex ++;
            } else {
                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(prevP.order.owner);
                batch[3 + batchIndex * 4] = bytes32(p.fillAmountS);
                batchIndex ++;
            }

            if (p.feeAmount > 0) {
                batch[0 + batchIndex * 4] = bytes32(p.order.feeToken);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(address(ctx.feeHolder));
                batch[3 + batchIndex * 4] = bytes32(p.feeAmount);
                batchIndex += 1;
            }

            if (p.splitS > 0) {
                batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                batch[2 + batchIndex * 4] = bytes32(address(ctx.feeHolder));
                batch[3 + batchIndex * 4] = bytes32(p.splitS);
                batchIndex ++;
            }
        }

        return (fills, batch);
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
