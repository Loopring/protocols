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
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            ring.hash = keccak256(
                abi.encodePacked(
                    ring.hash,
                    p.order.hash
                    // p.marginSplitAsFee
                )
            );
        }
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
            // p.fillAmountB = order.maxAmountB;
        }

        uint smallest = 0;

        for (uint i = 0; i < ring.size; i++) {
            smallest = calculateOrderFillAmounts(ring, i, smallest);
        }

        for (uint i = 0; i < smallest; i++) {
            calculateOrderFillAmounts(ring, i, smallest);
        }

        Data.Participation memory p = ring.participations[smallest];
        uint newFillAmountS = p.fillAmountB.mul(p.order.amountS) / p.order.amountB;
        p.splitS = newFillAmountS.sub(p.fillAmountS);
        p.fillAmountS = newFillAmountS;

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

    function settleRing(Data.Ring ring, Data.Context ctx, Data.Mining mining)
        internal
    {
        uint8 walletSplitPercentage = ctx.delegate.walletSplitPercentage();
        bytes32[][] memory batchList = new bytes32[][](ring.size);
        for (uint i = 0; i < ring.size; i++) {
            uint prevIndex = (i + ring.size - 1) % ring.size;
            Data.Participation memory p = ring.participations[i];
            Data.Participation memory prevP = ring.participations[prevIndex];

            bytes32[] memory batch;
            uint batchSize = 0;
            if (p.splitS > 0) {
                batchSize += 1;
            }

            if (p.lrcFee > 0) {
                batchSize += 1;
            }

            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                batchSize = batchSize * 2;
            }

            batchSize += 1;

            batch = new bytes32[](batchSize);

            batch[0] = bytes32(p.order.tokenS);
            batch[1] = bytes32(p.order.owner);
            batch[2] = bytes32(prevP.order.owner);
            batch[3] = bytes32(p.fillAmountS);

            uint index = 1;
            if (walletSplitPercentage > 0 && p.order.wallet != 0x0) {
                if (p.lrcFee > 0) {
                    batch[0 + index * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(mining.feeRecipient);
                    uint minerFee = p.lrcFee.mul(walletSplitPercentage) / 100;
                    batch[3 + index * 4] = bytes32(minerFee);

                    index += 1;

                    batch[0 + index * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(p.order.wallet);
                    batch[3 + index * 4] = bytes32(p.lrcFee.sub(minerFee));
                }

                if (p.splitS > 0) {
                    batch[0 + index * 4] = bytes32(p.order.tokenS);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(mining.feeRecipient);
                    uint minerSplitS = p.fillAmountS.mul(walletSplitPercentage) / 100;
                    batch[3 + index * 4] = bytes32(minerSplitS);

                    index += 1;

                    batch[0 + index * 4] = bytes32(p.order.tokenS);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(p.order.wallet);
                    batch[3 + index * 4] = bytes32(p.fillAmountS.sub(minerSplitS));
                }
            } else {
                if (p.lrcFee > 0) {
                    batch[0 + index * 4] = bytes32(ctx.lrcTokenAddress);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(mining.feeRecipient);
                    batch[3 + index * 4] = bytes32(p.lrcFee);
                    index += 1;
                }

                if (p.splitS > 0) {
                    batch[0 + index * 4] = bytes32(p.order.tokenS);
                    batch[1 + index * 4] = bytes32(p.order.owner);
                    batch[2 + index * 4] = bytes32(mining.feeRecipient);
                    batch[3 + index * 4] = bytes32(p.fillAmountS);
                }
            }

            batchList[i] = batch;
        }

        ctx.delegate.batchTransfer(batchList);
    }

}
