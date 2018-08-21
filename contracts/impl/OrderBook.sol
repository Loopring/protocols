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

import "../iface/IOrderBook.sol";
import "../lib/NoDefaultFunc.sol";
import "../impl/Data.sol";
import "../helper/OrderHelper.sol";


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract OrderBook is IOrderBook, NoDefaultFunc {
    using OrderHelper     for Data.Order;

    function submitOrder(bytes32[] dataArray)
        external
    {
        require(dataArray.length >= 9);
        bool allOrNone = false;
        if (uint(dataArray[7]) > 0) {
            allOrNone = true;
        }

        Data.Order memory order = Data.Order(
            msg.sender,
            address(dataArray[0]),
            address(dataArray[1]),
            uint(dataArray[3]),
            uint(dataArray[4]),
            uint(dataArray[5]),
            0x0,
            address(dataArray[2]),
            0x0,
            0x0,
            uint(dataArray[6]),
            new bytes(0),
            new bytes(0),
            allOrNone,
            0x0,
            uint(dataArray[7]),
            0,
            0,
            0,
            0,
            bytes32(0x0),
            0x0,
            0,
            0,
            0,
            0,
            true
        );

        order.updateHash();
        require(!orderSubmitted[order.hash]);
        orderSubmitted[order.hash] = true;
        orders[order.hash] = dataArray;
        emit OrderSubmitted(msg.sender, order.hash);
    }

}
