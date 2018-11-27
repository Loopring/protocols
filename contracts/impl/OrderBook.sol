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

import "../helper/OrderHelper.sol";
import "../iface/IOrderBook.sol";
import "../impl/Data.sol";
import "../lib/BytesUtil.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract OrderBook is IOrderBook, NoDefaultFunc {
    using OrderHelper     for Data.Order;
    using BytesUtil       for bytes;

    function submitOrder(
        bytes data
        )
        external
        returns (bytes32)
    {
        require(data.length >= 23 * 32, INVALID_SIZE);

        Data.Order memory order = Data.Order(
            0,                                                      // version
            address(data.bytesToUint(0 * 32)),                      // owner
            address(data.bytesToUint(1 * 32)),                      // tokenS
            address(data.bytesToUint(2 * 32)),                      // tokenB
            data.bytesToUint(3 * 32),                               // amountS
            data.bytesToUint(4 * 32),                               // amountB
            data.bytesToUint(5 * 32),                               // validSince
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            0x0,
            address(data.bytesToUint(6 * 32)),                      // broker
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            address(data.bytesToUint(7 * 32)),                      // orderInterceptor
            address(data.bytesToUint(8 * 32)),                      // wallet
            uint(data.bytesToUint(9 * 32)),                         // validUtil
            new bytes(0),
            new bytes(0),
            bool(data.bytesToUint(10 * 32) > 0),                    // allOrNone
            address(data.bytesToUint(11 * 32)),                     // feeToken
            data.bytesToUint(12 * 32),                              // feeAmount
            0,
            uint16(data.bytesToUint(13 * 32)),                      // tokenSFeePercentage
            uint16(data.bytesToUint(14 * 32)),                      // tokenBFeePercentage
            address(data.bytesToUint(15 * 32)),                     // tokenRecipient
            uint16(data.bytesToUint(16 * 32)),                      // walletSplitPercentage
            false,
            bytes32(0x0),
            0x0,
            0,
            0,
            true,
            Data.TokenType(data.bytesToUint(17 * 32)),              // tokenTypeS
            Data.TokenType(data.bytesToUint(18 * 32)),              // tokenTypeB
            Data.TokenType(data.bytesToUint(19 * 32)),              // tokenTypeFee
            data.bytesToBytes32(20 * 32),                           // trancheS
            data.bytesToBytes32(21 * 32),                           // trancheB
            data.subBytes(22 * 32)                                  // transferDataS
        );
        require(data.length == 23 * 32 + order.transferDataS.length, INVALID_SIZE);

        /// msg.sender must be order's owner or broker.
        /// no need to check order's broker is registered here. it will be checked during
        /// ring settlement.
        require(
            msg.sender == order.owner || msg.sender == order.broker,
            UNAUTHORIZED_ONCHAIN_ORDER
        );

        // Calculate the order hash
        order.updateHash();

        // Register the hash
        require(!orderSubmitted[order.hash], ALREADY_EXIST);
        orderSubmitted[order.hash] = true;

        // Broadcast the order data
        emit OrderSubmitted(order.hash, data);

        return order.hash;
    }

}
