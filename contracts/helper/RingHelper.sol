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
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "./ParticipationHelper.sol";
import "./TaxHelper.sol";


/// @title An Implementation of IOrderbook.
library RingHelper {
    using MathUint for uint;
    using ParticipationHelper for Data.Participation;
    using TaxHelper for Data.Tax;

    using BrokerInterceptorProxy for address;
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
                mstore(
                    add(add(orderHashes, 0x20), mul(i, 0x20)),
                    orderHash
                )
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
        int j;

        for (i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            p.fillAmountS = p.order.maxAmountS;
            if (ring.P2P) {
                // If this is a P2P ring we may have to pay a (pre-trading) percentage tokenS to
                // the wallet. We have to make sure the order owner can pay that percentage,
                // otherwise we'll have to sell less tokenS. We have to calculate totalAmountS here
                // so that:
                // fillAmountS := totalAmountS - (totalAmountS * (tokenSFeePercentage + tax))
                uint taxRateTokenS = ctx.tax.getTaxRate(
                    p.order.tokenS,
                    false,
                    true
                );

                // TODO: actual scale between tax and fees correctly using the variables
                // (they should probably use the same base to make this easy)
                uint totalAddedPercentage = p.order.tokenSFeePercentage + taxRateTokenS * 10;

                uint totalAmountS = p.fillAmountS.mul(
                    ctx.feePercentageBase) / (ctx.feePercentageBase - totalAddedPercentage);

                if (totalAmountS > p.order.spendableS) {
                    uint maxFeeAmountS = p.order.spendableS
                        .mul(totalAddedPercentage) / ctx.feePercentageBase;

                    p.fillAmountS = p.order.spendableS - maxFeeAmountS;
                }
            }
            p.fillAmountB = p.fillAmountS.mul(p.order.amountB) / p.order.amountS;
        }

        uint smallest = 0;
        for (j = int(ring.size) - 1; j >= 0; j--) {
            smallest = calculateOrderFillAmounts(
                ring,
                uint(j),
                smallest
            );
        }
        for (j = int(ring.size) - 1; j >= int(smallest); j--) {
            calculateOrderFillAmounts(
                ring,
                uint(j),
                smallest
            );
        }

        for (i = 0; i < ring.size; i++) {
            uint nextIndex = (i + 1) % ring.size;
            Data.Participation memory p = ring.participations[i];
            Data.Participation memory nextP = ring.participations[nextIndex];
            if (nextP.fillAmountS >= p.fillAmountB) {
                nextP.calculateFeesAndTaxes(p, ctx, ring.P2P);
                if (nextP.order.waiveFeePercentage < 0) {
                    ring.minerFeesToOrdersPercentage += uint(-nextP.order.waiveFeePercentage);
                }
            } else {
                ring.valid = false;
                break;
            }
        }
        // Miner can only distribute 100% of its fees to all orders combined
        ring.valid = ring.valid && ring.minerFeesToOrdersPercentage <= ctx.feePercentageBase;
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
            prevP.fillAmountS = prevP.fillAmountB
                .mul(prevP.order.amountS) / prevP.order.amountB;
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


    function settleRing(
        Data.Ring ring,
        Data.Context ctx,
        Data.Mining mining
        )
        internal
    {
        transferTokens(ring, ctx);
        payFees(ring, ctx, mining);

        // Adjust the orders
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            p.adjustOrderState();
        }
    }

    function generateFills(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
        returns (IExchange.Fill[])
    {
        IExchange.Fill[] memory fills = new IExchange.Fill[](ring.size);
        Data.Participation memory p;
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            fills[i].orderHash = p.order.hash;
            fills[i].owner = p.order.owner;
            fills[i].tokenS = p.order.tokenS;
            fills[i].amountS = p.fillAmountS;
            fills[i].split = p.splitS;
            fills[i].feeAmount = p.feeAmount;
        }
        return fills;
    }

    function transferTokens(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
    {
        // It only costs 3 gas/word for extra memory, so just create the maximum array size needed
        bytes32[] memory data = new bytes32[](ring.size * 3 * 4);
        uint offset = 0;
        Data.Participation memory p;
        Data.Participation memory prevP;
        address feeHolder = address(ctx.feeHolder);
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            prevP = ring.participations[(i + ring.size - 1) % ring.size];

            // If the buyer needs to pay fees in tokenB, the seller needs
            // to send the tokenS amount to the fee holder contract
            uint amountSToBuyer = p.fillAmountS
                .sub(prevP.feeAmountB)
                .sub(prevP.taxB);

            uint amountSToFeeHolder = p.splitS
                .add(p.feeAmountS)
                .add(p.taxS)
                .add(prevP.feeAmountB)
                .add(prevP.taxB);

            uint amountFeeToFeeHolder = p.feeAmount.add(p.taxFee);

            if (p.order.tokenS == p.order.feeToken) {
                amountSToFeeHolder += amountFeeToFeeHolder;
                amountFeeToFeeHolder = 0;
            }

            // Transfers
            offset = addTokenTransfer(
                data,
                offset,
                p.order.tokenS,
                p.order.owner,
                prevP.order.owner,
                amountSToBuyer
            );
            offset = addTokenTransfer(
                data,
                offset,
                p.order.tokenS,
                p.order.owner,
                feeHolder,
                amountSToFeeHolder
            );
            offset = addTokenTransfer(
                data,
                offset,
                p.order.feeToken,
                p.order.owner,
                feeHolder,
                amountFeeToFeeHolder
            );

            // onTokenSpent broker callbacks
            onTokenSpent(
                p.order.brokerInterceptor,
                p.order.owner,
                p.order.broker,
                p.order.tokenS,
                amountSToBuyer + amountSToFeeHolder
            );
            onTokenSpent(
                p.order.brokerInterceptor,
                p.order.owner,
                p.order.broker,
                p.order.feeToken,
                amountFeeToFeeHolder
            );
        }
        // Patch in the correct length of the data array
        assembly {
            mstore(data, offset)
        }
        ctx.delegate.batchTransfer(data);
    }

    function addTokenTransfer(
        bytes32[] data,
        uint offset,
        address token,
        address from,
        address to,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return offset;
        } else {
            assembly {
                let start := add(data, mul(add(offset, 1), 32))
                mstore(add(start,  0), token)
                mstore(add(start, 32), from)
                mstore(add(start, 64), to)
                mstore(add(start, 96), amount)
            }
            return offset + 4;
        }
    }

    function onTokenSpent(
        address brokerInterceptor,
        address owner,
        address broker,
        address token,
        uint    amount
        )
        internal
    {
        if (brokerInterceptor == 0x0 || amount == 0) {
            return;
        } else {
            brokerInterceptor.onTokenSpentSafe(
                owner,
                broker,
                token,
                amount
            );
        }
    }

    function payFees(
        Data.Ring ring,
        Data.Context ctx,
        Data.Mining mining
        )
        internal
    {
        // It only costs 3 gas/word for extra memory, so just create the maximum array size needed
        bytes32[] memory data = new bytes32[]((ring.size + 3) * ring.size * 3);
        Data.FeeContext memory feeCtx = Data.FeeContext(
            data,
            0,
            ring,
            ctx,
            mining,
            ring.P2P ? 100 : ctx.delegate.walletSplitPercentage()
        );
        Data.Participation memory p;
        for (uint i = 0; i < ring.size; i++) {
            p = ring.participations[i];
            uint feeInTokenS = p.feeAmountS + p.splitS;
            payFeesAndTaxes(
                feeCtx,
                p.order.feeToken,
                p.feeAmount,
                p.taxFee,
                p.order.wallet
            );
            payFeesAndTaxes(
                feeCtx,
                p.order.tokenS,
                feeInTokenS,
                p.taxS,
                p.order.wallet
            );
            payFeesAndTaxes(
                feeCtx,
                p.order.tokenB,
                p.feeAmountB,
                p.taxB,
                p.order.wallet
            );
        }
        // Patch in the correct length of the data array
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

        uint incomeTax = feeCtx.ctx.tax.calculateTax(
            token,
            true,
            feeCtx.ring.P2P,
            amount
        );

        uint incomeAfterTax = amount - incomeTax;

        uint feeToWallet = incomeAfterTax.mul(feeCtx.walletSplitPercentage) / 100;
        if (wallet == 0x0) {
            feeToWallet = 0;
        }
        uint minerFee = incomeAfterTax - feeToWallet;

        uint feeToMiner = minerFee;
        // Fees can be paid out in different tokens so we can't easily accumulate the total fee
        // that needs to be paid out to order owners. So we pay out each part out here to all
        // orders that need it.
        if (feeCtx.ring.minerFeesToOrdersPercentage > 0) {
            // Subtract all fees the miner pays to the orders
            feeToMiner = minerFee.mul(
                feeCtx.ctx.feePercentageBase - feeCtx.ring.minerFeesToOrdersPercentage)
                / feeCtx.ctx.feePercentageBase;
            // Pay out the fees to the orders
            distributeMinerFeeToOwners(
                feeCtx,
                token,
                minerFee
            );
        }
        feeCtx.offset = payFee(
            feeCtx.data,
            feeCtx.offset,
            token,
            wallet,
            feeToWallet
        );
        feeCtx.offset = payFee(
            feeCtx.data,
            feeCtx.offset,
            token,
            feeCtx.mining.feeRecipient,
            feeToMiner
        );
        // Pay the tax with the feeHolder as owner
        feeCtx.offset = payFee(
            feeCtx.data,
            feeCtx.offset,
            token,
            address(feeCtx.ctx.feeHolder),
            consumerTax + incomeTax
        );
    }

    function distributeMinerFeeToOwners(
        Data.FeeContext memory feeCtx,
        address token,
        uint minerFee
        )
        internal
        pure
    {
        for (uint i = 0; i < feeCtx.ring.size; i++) {
            Data.Participation memory p = feeCtx.ring.participations[i];
            if (p.order.waiveFeePercentage < 0) {
                uint feeToOwner = minerFee
                    .mul(uint(-p.order.waiveFeePercentage)) / feeCtx.ctx.feePercentageBase;

                feeCtx.offset = payFee(
                    feeCtx.data,
                    feeCtx.offset,
                    token,
                    p.order.owner,
                    feeToOwner);
            }
        }
    }

    function payFee(
        bytes32[] data,
        uint offset,
        address token,
        address owner,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return offset;
        } else {
            assembly {
                let start := add(data, mul(add(offset, 1), 32))
                mstore(add(start,  0), token)
                mstore(add(start, 32), owner)
                mstore(add(start, 64), amount)
            }
            return offset + 3;
        }
    }

    event LogTrans(
        address token,
        address from,
        address to,
        uint amount,
        uint spendable);

    function logTrans(
        bytes32[] batch,
        address delegateAddress
        )
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
        address spender
        )
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

}
