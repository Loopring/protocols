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

import "../impl/Data.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "../iface/IBrokerDelegate.sol";

/// @title OrderHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library OrderHelper {
    using MathUint      for uint;

    string constant internal EIP191_HEADER = "\x19\x01";
    string constant internal EIP712_DOMAIN_NAME = "Loopring Protocol";
    string constant internal EIP712_DOMAIN_VERSION = "2";
    bytes32 constant internal EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH = keccak256(
        abi.encodePacked(
            "EIP712Domain(",
            "string name,",
            "string version",
            ")"
        )
    );
    bytes32 constant internal EIP712_ORDER_SCHEMA_HASH = keccak256(
        abi.encodePacked(
            "Order(",
            "uint amountS,",
            "uint amountB,",
            "uint feeAmount,",
            "uint validSince,",
            "uint validUntil,",
            "address owner,",
            "address tokenS,",
            "address tokenB,",
            "address dualAuthAddr,",
            "address broker,",
            "address orderInterceptor,",
            "address wallet,",
            "address tokenRecipient,",
            "address feeToken,",
            "uint16 walletSplitPercentage,",
            "uint16 tokenSFeePercentage,",
            "uint16 tokenBFeePercentage,",
            "bool allOrNone,",
            "uint8 tokenTypeS,",
            "uint8 tokenTypeB,",
            "uint8 tokenTypeFee,",
            "bytes32 trancheS,",
            "bytes32 trancheB,",
            "bytes transferDataS",
            ")"
        )
    );
    bytes32 constant internal EIP712_DOMAIN_HASH = keccak256(
        abi.encodePacked(
            EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
            keccak256(bytes(EIP712_DOMAIN_NAME)),
            keccak256(bytes(EIP712_DOMAIN_VERSION))
        )
    );

    function updateHash(Data.Order memory order)
        internal
        pure
    {
        /* bytes32 message = keccak256( */
        /*     abi.encode( */
        /*         EIP712_ORDER_SCHEMA_HASH, */
        /*         order.amountS, */
        /*         order.amountB, */
        /*         order.feeAmount, */
        /*         order.validSince, */
        /*         order.validUntil, */
        /*         order.owner, */
        /*         order.tokenS, */
        /*         order.tokenB, */
        /*         order.dualAuthAddr, */
        /*         order.broker, */
        /*         order.orderInterceptor, */
        /*         order.wallet, */
        /*         order.tokenRecipient */
        /*         order.feeToken, */
        /*         order.walletSplitPercentage, */
        /*         order.tokenSFeePercentage, */
        /*         order.tokenBFeePercentage, */
        /*         order.allOrNone, */
        /*         order.tokenTypeS, */
        /*         order.tokenTypeB, */
        /*         order.tokenTypeFee, */
        /*         order.trancheS, */
        /*         order.trancheB, */
        /*         order.transferDataS */
        /*     ) */
        /* ); */
        /* order.hash = keccak256( */
        /*    abi.encodePacked( */
        /*        EIP191_HEADER, */
        /*        EIP712_DOMAIN_HASH, */
        /*        message */
        /*    ) */
        /*); */

        // Precalculated EIP712_ORDER_SCHEMA_HASH amd EIP712_DOMAIN_HASH because
        // the solidity compiler doesn't correctly precalculate them for us.
        bytes32 _EIP712_ORDER_SCHEMA_HASH = 0x40b942178d2a51f1f61934268590778feb8114db632db7d88537c98d2b05c5f2;
        bytes32 _EIP712_DOMAIN_HASH = 0xaea25658c273c666156bd427f83a666135fcde6887a6c25fc1cd1562bc4f3f34;

        bytes32 hash;
        assembly {
            // Calculate the hash for transferDataS separately
            let transferDataS := mload(add(order, 1184))              // order.transferDataS
            let transferDataSHash := keccak256(add(transferDataS, 32), mload(transferDataS))

            let ptr := mload(64)
            mstore(add(ptr,   0), _EIP712_ORDER_SCHEMA_HASH)     // EIP712_ORDER_SCHEMA_HASH
            mstore(add(ptr,  32), mload(add(order, 128)))        // order.amountS
            mstore(add(ptr,  64), mload(add(order, 160)))        // order.amountB
            mstore(add(ptr,  96), mload(add(order, 640)))        // order.feeAmount
            mstore(add(ptr, 128), mload(add(order, 192)))        // order.validSince
            mstore(add(ptr, 160), mload(add(order, 480)))        // order.validUntil
            mstore(add(ptr, 192), mload(add(order,  32)))        // order.owner
            mstore(add(ptr, 224), mload(add(order,  64)))        // order.tokenS
            mstore(add(ptr, 256), mload(add(order,  96)))        // order.tokenB
            mstore(add(ptr, 288), mload(add(order, 288)))        // order.dualAuthAddr
            mstore(add(ptr, 320), mload(add(order, 320)))        // order.broker
            mstore(add(ptr, 352), mload(add(order, 416)))        // order.orderInterceptor
            mstore(add(ptr, 384), mload(add(order, 448)))        // order.wallet
            mstore(add(ptr, 416), mload(add(order, 768)))        // order.tokenRecipient
            mstore(add(ptr, 448), mload(add(order, 608)))        // order.feeToken
            mstore(add(ptr, 480), mload(add(order, 800)))        // order.walletSplitPercentage
            mstore(add(ptr, 512), mload(add(order, 704)))        // order.tokenSFeePercentage
            mstore(add(ptr, 544), mload(add(order, 736)))        // order.tokenBFeePercentage
            mstore(add(ptr, 576), mload(add(order, 576)))        // order.allOrNone
            mstore(add(ptr, 608), mload(add(order, 1024)))       // order.tokenTypeS
            mstore(add(ptr, 640), mload(add(order, 1056)))       // order.tokenTypeB
            mstore(add(ptr, 672), mload(add(order, 1088)))       // order.tokenTypeFee
            mstore(add(ptr, 704), mload(add(order, 1120)))       // order.trancheS
            mstore(add(ptr, 736), mload(add(order, 1152)))       // order.trancheB
            mstore(add(ptr, 768), transferDataSHash)             // keccak256(order.transferDataS)
            let message := keccak256(ptr, 800)                   // 25 * 32

            mstore(add(ptr,  0), 0x1901)                         // EIP191_HEADER
            mstore(add(ptr, 32), _EIP712_DOMAIN_HASH)            // EIP712_DOMAIN_HASH
            mstore(add(ptr, 64), message)                        // message
            hash := keccak256(add(ptr, 30), 66)                  // 2 + 32 + 32
        }
        order.hash = hash;
    }

    function check(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
    {
        // If the order was already partially filled
        // we don't have to check all of the infos and the signature again
        if(order.filledAmountS == 0) {
            validateAllInfo(order, ctx);
            checkOwnerSignature(order, ctx);
        } else {
            validateUnstableInfo(order, ctx);
        }

        checkP2P(order);
    }

    function validateAllInfo(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
    {
        bool valid = true;
        valid = valid && (order.version == 0); // unsupported order version
        valid = valid && (order.owner != address(0x0)); // invalid order owner
        valid = valid && (order.tokenS != address(0x0)); // invalid order tokenS
        valid = valid && (order.tokenB != address(0x0)); // invalid order tokenB
        valid = valid && (order.amountS != 0); // invalid order amountS
        valid = valid && (order.amountB != 0); // invalid order amountB
        valid = valid && (order.feeToken != address(0x0)); // invalid fee token

        valid = valid && (order.tokenSFeePercentage < ctx.feePercentageBase); // invalid tokenS percentage
        valid = valid && (order.tokenBFeePercentage < ctx.feePercentageBase); // invalid tokenB percentage
        valid = valid && (order.walletSplitPercentage <= 100); // invalid wallet split percentage

        // We only support ERC20 for now
        valid = valid && (order.tokenTypeS == Data.TokenType.ERC20 && order.trancheS == 0x0);
        valid = valid && (order.tokenTypeFee == Data.TokenType.ERC20);

        // NOTICE: replaced to allow orders to specify market's primary token (to denote order side)
        // valid = valid && (order.tokenTypeB == Data.TokenType.ERC20 && order.trancheB == 0x0);
        valid = valid && (order.tokenTypeB == Data.TokenType.ERC20) && (
            bytes32ToAddress(order.trancheB) == order.tokenB ||
            bytes32ToAddress(order.trancheB) == order.tokenS
        );

        // NOTICE: commented to allow order.transferDataS to be used for dApps building on Loopring
        // valid = valid && (order.transferDataS.length == 0);

        valid = valid && (order.validSince <= now); // order is too early to match

        order.valid = order.valid && valid;

        validateUnstableInfo(order, ctx);
    }


    function validateUnstableInfo(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
    {
        bool valid = true;
        valid = valid && (order.validUntil == 0 || order.validUntil > now);  // order is expired
        valid = valid && (order.waiveFeePercentage <= int16(ctx.feePercentageBase)); // invalid waive percentage
        valid = valid && (order.waiveFeePercentage >= -int16(ctx.feePercentageBase)); // invalid waive percentage
        if (order.dualAuthAddr != address(0x0)) { // if dualAuthAddr exists, dualAuthSig must be exist.
            valid = valid && (order.dualAuthSig.length > 0);
        }
        order.valid = order.valid && valid;
    }


    function checkP2P(
        Data.Order memory order
        )
        internal
        pure
    {
        order.P2P = (order.tokenSFeePercentage > 0 || order.tokenBFeePercentage > 0);
    }

    function isBuy(Data.Order memory order) internal pure returns (bool) {
        return bytes32ToAddress(order.trancheB) == order.tokenB;
    }

    function checkOwnerSignature(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
    {
        if (order.sig.length == 0) {
            bool registered = ctx.orderRegistry.isOrderHashRegistered(
                order.owner,
                order.hash
            );

            if (!registered) {
                order.valid = order.valid && ctx.orderBook.orderSubmitted(order.hash);
            }
        } else {
            order.valid = order.valid && MultihashUtil.verifySignature(
                order.owner,
                order.hash,
                order.sig
            );
            require(order.valid, 'INVALID_SIGNATURE');
        }
    }

    function checkDualAuthSignature(
        Data.Order memory order,
        bytes32 miningHash
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
            require(order.valid, 'INVALID_DUAL_AUTH_SIGNATURE');
        }
    }

    function validateAllOrNone(
        Data.Order memory order
        )
        internal
        pure
    {
        // Check if this order needs to be completely filled
        if(order.allOrNone) {
            order.valid = order.valid && (order.filledAmountS == order.amountS);
        }
    }

    function getBrokerHash(Data.Order memory order) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(order.broker, order.tokenS, order.tokenB, order.feeToken));
    }

    function getSpendableS(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
        returns (uint)
    {
        return getSpendable(
            order,
            ctx.delegate,
            order.tokenS,
            order.owner,
            order.tokenSpendableS
        );
    }

    function getSpendableFee(
        Data.Order memory order,
        Data.Context memory ctx
        )
        internal
        view
        returns (uint)
    {
        return getSpendable(
            order,
            ctx.delegate,
            order.feeToken,
            order.owner,
            order.tokenSpendableFee
        );
    }

    function reserveAmountS(
        Data.Order memory order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved += amount;
    }

    function reserveAmountFee(
        Data.Order memory order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableFee.reserved += amount;
    }

    function resetReservations(
        Data.Order memory order
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved = 0;
        order.tokenSpendableFee.reserved = 0;
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    function getERC20Spendable(
        Data.Order memory order,
        ITradeDelegate delegate,
        address tokenAddress,
        address owner
        )
        private
        view
        returns (uint spendable)
    {
        if (order.broker == address(0x0)) {
            ERC20 token = ERC20(tokenAddress);
            spendable = token.allowance(
                owner,
                address(delegate)
            );
            if (spendable != 0) {
                uint balance = token.balanceOf(owner);
                spendable = (balance < spendable) ? balance : spendable;
            }
        } else {
            IBrokerDelegate broker = IBrokerDelegate(order.broker);
            spendable = broker.brokerBalanceOf(owner, tokenAddress);
        }
    }

    function getSpendable(
        Data.Order memory order,
        ITradeDelegate delegate,
        address tokenAddress,
        address owner,
        Data.Spendable memory tokenSpendable
        )
        private
        view
        returns (uint spendable)
    {
        if (!tokenSpendable.initialized) {
            tokenSpendable.amount = getERC20Spendable(
                order,
                delegate,
                tokenAddress,
                owner
            );
            tokenSpendable.initialized = true;
        }
        spendable = tokenSpendable.amount.sub(tokenSpendable.reserved);
    }

    function bytes32ToAddress(bytes32 data) private pure returns (address) {
        return address(uint160(uint256(data)));
    }
}
