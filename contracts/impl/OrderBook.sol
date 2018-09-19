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

import "../iface/Errors.sol";
import "../iface/IOrderBook.sol";
import "../lib/NoDefaultFunc.sol";
import "../impl/Data.sol";
import "../helper/OrderHelper.sol";


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract OrderBook is IOrderBook, NoDefaultFunc, Errors {
    using OrderHelper     for Data.Order;

    function submitOrder(bytes32[] dataArray)
        external
    {
        require(dataArray.length >= 18, INVALID_SIZE);
        bool allOrNone = false;
        if (uint(dataArray[17]) > 0) {
            allOrNone = true;
        }

        Data.Order memory order = Data.Order(
            address(dataArray[0]), // owner
            address(dataArray[1]), // tokenS
            address(dataArray[2]), // tokenB
            uint(dataArray[3]), // amountS
            uint(dataArray[4]), // amountB
            uint(dataArray[5]), // validSince
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            0x0,
            address(dataArray[6]), // broker
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            address(dataArray[7]), // orderInterceptor
            address(dataArray[8]), // wallet
            uint(dataArray[9]), // validUtil
            new bytes(0),
            new bytes(0),
            allOrNone,
            address(dataArray[10]), // feeToken
            uint(dataArray[11]), // feeAmount
            uint16(dataArray[12]), // feePercentage
            0,
            uint16(dataArray[13]), // tokenSFeePercentage
            uint16(dataArray[14]), // tokenBFeePercentage
            address(dataArray[15]), // tokenRecipient
            uint16(dataArray[16]), // walletSplitPercentage
            false,
            bytes32(0x0),
            0x0,
            0,
            true
        );

        order.updateHash();
        require(!orderSubmitted[order.hash], ALREADY_REGISTERED);

        orderSubmitted[order.hash] = true;
        orders[order.hash] = dataArray;
        emit OrderSubmitted(msg.sender, order.hash);
    }

    function getOrderData(bytes32 orderHash)
        view
        external
        returns (bytes32[])
    {
        return orders[orderHash];
    }

}
