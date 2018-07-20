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
import "../impl/Data.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "./ParticipationHelper.sol";


/// @title An Implementation of IOrderbook.
library RingHelper {
    using MathUint for uint;
    using ParticipationHelper for Data.Participation;

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
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            Data.Order memory order = p.order;
            p.fillAmountS = order.maxAmountS;
        }

        uint smallest = 0;

        for (uint i = 0; i < ring.size; i++) {
            smallest = calculateOrderFillAmounts(ring, i, smallest);
        }

        for (uint i = 0; i < smallest; i++) {
            calculateOrderFillAmounts(ring, i, smallest);
        }

        Data.Participation memory smallestP = ring.participations[smallest];
        uint newFillAmountS = smallestP.fillAmountB.mul(smallestP.order.amountS) / smallestP.order.amountB;
        smallestP.splitS = newFillAmountS.sub(smallestP.fillAmountS);
        smallestP.fillAmountS = newFillAmountS;

        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            // p.calculateFeeAmounts(mining);
            p.adjustOrderState();
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
        if (p.calculateFillAmounts()) {
            smallest_ = i;
        }

        uint j = (i + 1) % ring.size;
        Data.Participation memory nextP = ring.participations[j];

        if (p.fillAmountB < nextP.fillAmountS) {
            nextP.fillAmountS = p.fillAmountB;
        } else {
            smallest_ = j;
        }
    }

    function calculateTransferBatchSize(
        Data.Ring ring,
        uint8 walletSplitPercentage
        )
        internal
        returns (uint)
    {
        uint batchSize = 0;
        for (uint i = 0; i < ring.size; i++) {
            uint orderTransSize = 0;
            Data.Participation memory p = ring.participations[i];

            if (p.splitS > 0) {
                orderTransSize ++;
            }

            if (p.lrcFee > 0) {
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

    event LogTrans(address token, address from, address to, uint amount);
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
        for (i = 0; i < ring.size; i++) {
            uint prevIndex = (i + ring.size - 1) % ring.size;
            Data.Participation memory p = ring.participations[i];
            Data.Participation memory prevP = ring.participations[prevIndex];

            fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS > 0 ? int(p.splitS) : -int(p.splitB);
            fills[i].lrcFee = p.lrcFee;

            batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
            batch[1 + batchIndex * 4] = bytes32(p.order.owner);
            batch[2 + batchIndex * 4] = bytes32(prevP.order.owner);
            batch[3 + batchIndex * 4] = bytes32(p.fillAmountS);
            batchIndex ++;
            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                if (p.lrcFee > 0) {
                    batch[0 + batchIndex * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    uint minerFee = p.lrcFee.mul(walletSplitPercentage) / 100;
                    batch[3 + batchIndex * 4] = bytes32(minerFee);
                    batchIndex ++;

                    batch[0 + batchIndex * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(p.order.wallet);
                    batch[3 + batchIndex * 4] = bytes32(p.lrcFee.sub(minerFee));
                    batchIndex ++;
                }

                if (p.splitS > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    uint minerSplitS = p.fillAmountS.mul(walletSplitPercentage) / 100;
                    batch[3 + batchIndex * 4] = bytes32(minerSplitS);
                    batchIndex ++;

                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(p.order.wallet);
                    batch[3 + batchIndex * 4] = bytes32(p.fillAmountS.sub(minerSplitS));
                    batchIndex ++;
                }
            } else {
                if (p.lrcFee > 0) {
                    batch[0 + batchIndex * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.lrcFee);
                    batchIndex += 1;
                }

                if (p.splitS > 0) {
                    batch[0 + batchIndex * 4] = bytes32(p.order.tokenS);
                    batch[1 + batchIndex * 4] = bytes32(p.order.owner);
                    batch[2 + batchIndex * 4] = bytes32(mining.feeRecipient);
                    batch[3 + batchIndex * 4] = bytes32(p.fillAmountS);
                    batchIndex ++;
                }
            }
        }

        for (i = 0; i < batch.length; i += 4) {
            emit LogTrans(
                address(batch[i]),
                address(batch[i + 1]),
                address(batch[i + 2]),
                uint(batch[i + 3])
            );
        }

        ctx.delegate.batchTransfer(batch);
    }

    function batchUpdateOrderFillAmount(Data.Ring ring, Data.Context ctx)
        internal
    {

    }

}
