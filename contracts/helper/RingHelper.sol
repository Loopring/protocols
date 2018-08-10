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

    uint private constant RATE_PERCISION = 10 ** 18;
    uint private constant DUST = 1000;

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
        view
    {
        uint i;
        uint totalRate = RATE_PERCISION;
        for (i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            Data.Order memory order = p.order;
            p.fillAmountS = order.maxAmountS;
            totalRate = totalRate.mul(order.amountS) / order.amountB;
        }
        if (totalRate < RATE_PERCISION) {
            ring.valid = false;
        } else {
            uint smallest = 0;

            for (i = 0; i < ring.size; i++) {
                smallest = calculateOrderFillAmounts(ring, i, smallest, totalRate);
            }

            for (i = 0; i < smallest; i++) {
                calculateOrderFillAmounts(ring, i, smallest, totalRate);
            }

            uint nextIndex = 0;
            for (i = 0; i < ring.size; i++) {
                nextIndex = (i + 1) % ring.size;
                Data.Participation memory p = ring.participations[i];
                Data.Participation memory nextP = ring.participations[nextIndex];
                if (nextP.fillAmountS > p.fillAmountB) {
                    nextP.splitS = nextP.fillAmountS - p.fillAmountB;
                    nextP.fillAmountS = p.fillAmountB;
                }
                // p.calculateFeeAmounts(mining);
                p.adjustOrderState();
            }
        }
    }

    function calculateOrderFillAmounts(
        Data.Ring ring,
        uint i,
        uint smallest,
        uint totalRate
        )
        internal
        pure
        returns (uint smallest_)
    {
        // Default to the same smallest index
        smallest_ = smallest;

        Data.Participation memory p = ring.participations[i];
        uint j = (i + 1) % ring.size;
        Data.Participation memory nextP = ring.participations[j];

        p.fillAmountB = p.fillAmountS.mul(p.order.amountB) / p.order.amountS;
        uint scaledFillAmountB = p.fillAmountB.mul(totalRate) / RATE_PERCISION;
        if (nextP.fillAmountS >= scaledFillAmountB) {
            nextP.fillAmountS = scaledFillAmountB;
        } else {
            smallest_ = j;
        }

        p.feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
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
        returns (uint)
    {
        uint batchSize = 0;
        uint orderTransSize;
        for (uint i = 0; i < ring.size; i++) {
            orderTransSize = 0;
            Data.Participation memory p = ring.participations[i];

            if (p.splitS > 0) {
                orderTransSize ++;
            }

            if (p.feeAmount > 0) {
                orderTransSize ++;
            }

            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                orderTransSize = orderTransSize * 2;
            }

            orderTransSize += 1;
            batchSize += orderTransSize;
        }
        return batchSize;
    }

    event LogTrans(address token, address from, address to, uint amount, uint spendable);
    function settleRing(Data.Ring ring, Data.Context ctx, Data.Mining mining)
        internal
        returns (IExchange.Fill[] memory fills)
    {
        uint8 walletSplitPercentage = ctx.delegate.walletSplitPercentage();

        fills = new IExchange.Fill[](ring.size);
        uint batchSize = calculateTransferBatchSize(ring, walletSplitPercentage);
        bytes32[] memory batch = new bytes32[](batchSize * 4);
        uint batchIndex = 0;
        uint i;
        Data.Participation memory p;
        for (i = 0; i < ring.size; i++) {
            uint prevIndex = (i + ring.size - 1) % ring.size;
            p = ring.participations[i];
            Data.Participation memory prevP = ring.participations[prevIndex];

            fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS > 0 ? int(p.splitS) : -int(p.splitB);
            fills[i].feeAmount = p.feeAmount;

            batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
            batch[1 + batchIndex * 4] = bytes32(p.order.owner);
            batch[2 + batchIndex * 4] = bytes32(prevP.order.owner);
            batch[3 + batchIndex * 4] = bytes32(p.fillAmountS);
            batchIndex ++;
            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                if (p.feeAmount > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.feeToken);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(p.order.wallet);
                    uint walletFee = p.feeAmount.mul(walletSplitPercentage) / 100;
                    batch[3 + batchIndex * 4] = bytes32(walletFee);
                    batchIndex ++;

                    batch[0 + batchIndex * 4] = bytes32(p.order.feeToken);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.feeAmount.sub(walletFee));
                    batchIndex ++;
                }

                if (p.splitS > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(p.order.wallet);
                    uint walletSplitS = p.splitS.mul(walletSplitPercentage) / 100;
                    batch[3 + batchIndex * 4] = bytes32(walletSplitS);
                    batchIndex ++;

                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.splitS.sub(walletSplitS));
                    batchIndex ++;
                }
            } else {
                if (p.feeAmount > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.feeToken);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.feeAmount);
                    batchIndex += 1;
                }

                if (p.splitS > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.splitS);
                    batchIndex ++;
                }
            }
        }

        // logTrans(batch, address(ctx.delegate));
        ctx.delegate.batchTransfer(batch);

        for (i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            if (p.order.brokerInterceptor != 0x0) {
                p.order.brokerInterceptor.onTokenSpentSafe(
                    p.order.owner,
                    p.order.broker,
                    p.order.tokenS,
                    p.fillAmountS
                );
                // Might want to add LRC and/or other fee payment here as well
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

    function batchUpdateOrderFillAmount(Data.Ring ring, Data.Context ctx)
        internal
    {

    }
}
