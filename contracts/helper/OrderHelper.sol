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


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
library OrderHelper {
    using MathUint      for uint;
    using BrokerInterceptorProxy for address;

    function updateHash(Data.Order order)
        internal
        pure
    {
        // 'Stack too deep' errors when hashing all parameters at once in keccak256,
        // so currently hashed in 2 parts.
        // TODO: once order data is finalized this can be optimized using assembly
        bytes32 hashPart1 = keccak256(
            abi.encodePacked(
                order.owner,
                order.tokenS,
                order.tokenB,
                order.amountS,
                order.amountB,
                order.dualAuthAddr,
                order.broker,
                order.orderInterceptor,
                order.wallet,
                order.validSince,
                order.validUntil,
                order.allOrNone
            )
        );
        bytes32 hashPart2 = keccak256(
            abi.encodePacked(
                order.feeToken,
                order.feeAmount,
                order.feePercentage,
                order.tokenSFeePercentage,
                order.tokenBFeePercentage
            )
        );
        order.hash = keccak256(
            abi.encodePacked(
                hashPart1,
                hashPart2
            )
        );
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
    {
        order.maxAmountFee = getSpendable(
            ctx.delegate,
            order.feeToken,
            order.owner,
            order.broker,
            order.brokerInterceptor
        );

        order.filledAmountS = ctx.delegate.filled(order.hash);
        order.maxAmountS = order.amountS.sub(order.filledAmountS);

        uint spendableS = getSpendable(
            ctx.delegate,
            order.tokenS,
            order.owner,
            order.broker,
            order.brokerInterceptor
        );

        if (order.maxAmountS > spendableS) {
            order.maxAmountS = spendableS;
        }

        order.maxAmountB = order.maxAmountS.mul(order.amountB) / order.amountS;
    }

    function validateInfo(Data.Order order)
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

        valid = valid && (order.validSince <= block.timestamp); // order is too early to match
        valid = valid && (order.validUntil > block.timestamp);  // order is expired

        order.valid = order.valid && valid;
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

       /// @return Amount of ERC20 token that can be spent by this contract.
    function getSpendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address tokenOwner,
        address broker,
        address brokerInterceptor
        )
        private
        returns (uint spendable)
    {
        ERC20 token = ERC20(tokenAddress);
        spendable = token.allowance(
            tokenOwner,
            address(delegate)
        );
        if (spendable == 0) {
            return;
        }
        uint amount = token.balanceOf(tokenOwner);
        if (amount < spendable) {
            spendable = amount;
            if (spendable == 0) {
                return;
            }
        }

        if (brokerInterceptor != 0x0 && broker != tokenOwner) {
            amount = brokerInterceptor.getAllowanceSafe(
                tokenOwner,
                broker,
                tokenAddress
            );
            if (amount < spendable) {
                spendable = amount;
            }
        }
    }
}
