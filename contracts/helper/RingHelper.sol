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
                    uint totalAmountFeeToken = nextP.feeAmount;
                    if (nextP.order.feeToken == nextP.order.tokenS) {
                        totalAmountFeeToken += nextP.fillAmountS;
                    }
                    if (totalAmountFeeToken > nextP.order.spendableFee) {
                        nextP.feeAmountB = nextP.fillAmountB.mul(nextP.order.feePercentage) / 1000;
                        nextP.feeAmount = 0;
                    }

                    // The miner/wallet gets the margin
                    nextP.splitS = nextP.fillAmountS - p.fillAmountB;
                    nextP.fillAmountS = p.fillAmountB;
                }
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
    }

    event LogTrans(address token, address from, address to, uint amount, uint spendable);
    function settleRing(Data.Ring ring, Data.Context ctx, Data.Mining mining)
        internal
        // returns (IExchange.Fill[] memory fills)
    {
        uint batchSize;
        uint feeTransSize;
        uint8 walletSplitPercentage = ctx.delegate.walletSplitPercentage();
        (batchSize, feeTransSize) = calculateTransferBatchSize(ring, walletSplitPercentage);

        bytes32[] memory batch;
        (/*fills, */batch) = generateBatchTransferData(ring, address(ctx.feeHolder), batchSize);
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
    }

    function generateBatchTransferData(
        Data.Ring ring,
        address feeHolder,
        uint batchSize)
        internal
        // pure
        returns (/*IExchange.Fill[],*/ bytes32[])
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
            amountSToBuyer = p.fillAmountS.sub(prevP.feeAmountB);
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

        return (/*fills, */batch);
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
