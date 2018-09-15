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
import "../impl/BrokerInterceptorProxy.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";


/// @title OrderHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library OrderHelper {
    using MathUint      for uint;
    using BrokerInterceptorProxy for address;

    function updateHash(Data.Order order)
        internal
        pure
    {
        // order.hash = keccak256(
        //     abi.encodePacked(
        //         order.amountS,
        //         order.amountB,
        //         order.feeAmount,
        //         order.validSince,
        //         order.validUntil,
        //         order.owner,
        //         order.tokenS,
        //         order.tokenB,
        //         order.dualAuthAddr,
        //         order.broker,
        //         order.orderInterceptor,
        //         order.wallet,
        //         order.tokenRecipient,
        //         order.feeToken,
        //         order.walletSplitPercentage,
        //         order.feePercentage,
        //         order.tokenSFeePercentage,
        //         order.tokenBFeePercentage,
        //         order.allOrNone
        //     )
        // );
        bytes32 hash;
        assembly {
            // Load the free memory pointer
            let ptr := mload(64)

            // We store the members back to front so we can overwrite data for members smaller than 32
            // (mstore always writes 32 bytes)
            mstore(add(ptr, sub(348, 31)), mload(add(order, 544)))   // allOrNone
            mstore(add(ptr, sub(346, 30)), mload(add(order, 736)))   // tokenBFeePercentage
            mstore(add(ptr, sub(344, 30)), mload(add(order, 704)))   // tokenSFeePercentage
            mstore(add(ptr, sub(342, 30)), mload(add(order, 640)))   // feePercentage
            mstore(add(ptr, sub(340, 30)), mload(add(order, 800)))   // walletSplitPercentage
            mstore(add(ptr, sub(320, 12)), mload(add(order, 576)))   // feeToken
            mstore(add(ptr, sub(300, 12)), mload(add(order, 768)))   // tokenRecipient
            mstore(add(ptr, sub(280, 12)), mload(add(order, 416)))   // wallet
            mstore(add(ptr, sub(260, 12)), mload(add(order, 384)))   // orderInterceptor
            mstore(add(ptr, sub(240, 12)), mload(add(order, 288)))   // broker
            mstore(add(ptr, sub(220, 12)), mload(add(order, 256)))   // dualAuthAddr
            mstore(add(ptr, sub(200, 12)), mload(add(order,  64)))   // tokenB
            mstore(add(ptr, sub(180, 12)), mload(add(order,  32)))   // tokenS
            mstore(add(ptr, sub(160, 12)), mload(add(order,   0)))   // owner
            mstore(add(ptr, sub(128,  0)), mload(add(order, 448)))   // validUntil
            mstore(add(ptr, sub( 96,  0)), mload(add(order, 160)))   // validSince
            mstore(add(ptr, sub( 64,  0)), mload(add(order, 608)))   // feeAmount
            mstore(add(ptr, sub( 32,  0)), mload(add(order, 128)))   // amountB
            mstore(add(ptr, sub(  0,  0)), mload(add(order,  96)))   // amountS

            hash := keccak256(ptr, 349)  // 5*32 + 9*20 + 4*2 + 1*1
        }
        order.hash = hash;
    }

    function updateBrokerAndInterceptor(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        if (order.broker == address(0x0)) {
            order.broker = order.owner;
        } else {
            bool registered;
            (registered, order.brokerInterceptor) = ctx.orderBrokerRegistry.getBroker(
                order.owner,
                order.broker
            );
            order.valid = order.valid && registered;
        }
    }

    function updateStates(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        order.filledAmountS = ctx.delegate.filled(order.hash);
    }

    function validateInfo(Data.Order order, Data.Context ctx)
        internal
        view
    {
        bool valid = true;
        valid = valid && (order.owner != 0x0); // invalid order owner
        valid = valid && (order.tokenS != 0x0); // invalid order tokenS
        valid = valid && (order.tokenB != 0x0); // invalid order tokenB
        valid = valid && (order.amountS != 0); // invalid order amountS
        valid = valid && (order.amountB != 0); // invalid order amountB
        valid = valid && (order.feeToken != 0x0); // invalid fee token
        valid = valid && (order.feePercentage < ctx.feePercentageBase); // invalid fee percentage
        valid = valid && (order.waiveFeePercentage <= int16(ctx.feePercentageBase)); // invalid waive percentage
        valid = valid && (order.waiveFeePercentage >= -int16(ctx.feePercentageBase)); // invalid waive percentage
        valid = valid && (order.tokenSFeePercentage < ctx.feePercentageBase); // invalid tokenS percentage
        valid = valid && (order.tokenBFeePercentage < ctx.feePercentageBase); // invalid tokenB percentage
        valid = valid && (order.walletSplitPercentage <= 100); // invalid wallet split percentage

        valid = valid && (order.validSince <= block.timestamp); // order is too early to match
        valid = valid && (order.validUntil > block.timestamp);  // order is expired

        order.valid = order.valid && valid;
    }

    function checkP2P(
        Data.Order order
        )
        internal
        pure
    {
        order.P2P = (order.tokenSFeePercentage > 0 || order.tokenBFeePercentage > 0);
    }

    function checkBrokerSignature(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        if (order.sig.length == 0) {
            order.valid = order.valid && ctx.orderRegistry.isOrderHashRegistered(
                order.broker,
                order.hash
            );
        } else {
            order.valid = order.valid && MultihashUtil.verifySignature(
                order.broker,
                order.hash,
                order.sig
            );
        }
    }

    function checkDualAuthSignature(
        Data.Order order,
        bytes32  miningHash
        )
        internal
        pure
    {
        if (order.dualAuthSig.length != 0) {
            order.valid = order.valid && MultihashUtil.verifySignature(
                order.dualAuthAddr,
                miningHash,
                order.dualAuthSig
            );
        }
    }

    function getSpendableS(
        Data.Order order,
        Data.Context ctx
        )
        internal
        returns (uint)
    {
        return getSpendable(
            ctx.delegate,
            order.tokenS,
            order.owner,
            order.broker,
            order.brokerInterceptor,
            order.tokenSpendableS,
            order.brokerSpendableS
        );
    }

    function getSpendableFee(
        Data.Order order,
        Data.Context ctx
        )
        internal
        returns (uint)
    {
        return getSpendable(
            ctx.delegate,
            order.feeToken,
            order.owner,
            order.broker,
            order.brokerInterceptor,
            order.tokenSpendableFee,
            order.brokerSpendableFee
        );
    }

    function reserveAmountS(
        Data.Order order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved += amount;
    }

    function reserveAmountFee(
        Data.Order order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableFee.reserved += amount;
    }

    function resetReservations(
        Data.Order order
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved = 0;
        order.tokenSpendableFee.reserved = 0;
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    function getERC20Spendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address owner
        )
        private
        view
        returns (uint spendable)
    {
        ERC20 token = ERC20(tokenAddress);
        spendable = token.allowance(
            owner,
            address(delegate)
        );
        if (spendable == 0) {
            return;
        }
        uint balance = token.balanceOf(owner);
        spendable = (balance < spendable) ? balance : spendable;
    }

    /// @return Amount of ERC20 token that can be spent by the broker
    function getBrokerAllowance(
        address tokenAddress,
        address owner,
        address broker,
        address brokerInterceptor
        )
        private
        returns (uint allowance)
    {
        allowance = brokerInterceptor.getAllowanceSafe(
            owner,
            broker,
            tokenAddress
        );
    }

    function getSpendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address owner,
        address broker,
        address brokerInterceptor,
        Data.Spendable tokenSpendable,
        Data.Spendable brokerSpendable
        )
        private
        returns (uint spendable)
    {
        if (!tokenSpendable.initialized) {
            tokenSpendable.amount = getERC20Spendable(
                delegate,
                tokenAddress,
                owner
            );
            tokenSpendable.initialized = true;
        }
        spendable = tokenSpendable.amount;
        if (brokerInterceptor != 0x0) {
            if (!brokerSpendable.initialized) {
                brokerSpendable.amount = getBrokerAllowance(
                    tokenAddress,
                    owner,
                    broker,
                    brokerInterceptor
                );
                brokerSpendable.initialized = true;
            }
            spendable = (brokerSpendable.amount < spendable) ? brokerSpendable.amount : spendable;
        }
        spendable = spendable.sub(tokenSpendable.reserved);
    }
}
