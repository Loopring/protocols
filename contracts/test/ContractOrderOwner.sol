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

import "../iface/IOrderCanceller.sol";
import "../iface/IOrderBook.sol";
import "../iface/IOrderRegistry.sol";
import "../lib/ERC20.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract ContractOrderOwner {

    address public orderBookAddress = 0x0;
    address public orderCancellerAddress = 0x0;

    constructor(
        address _orderBookAddress,
        address _orderCancellerAddress
        )
        public
    {
        orderBookAddress = _orderBookAddress;
        orderCancellerAddress = _orderCancellerAddress;
    }

    function sumbitOrderToOrderBook(
        bytes data,
        bytes32 expectedOrderHash
        )
        external
    {
        bytes32 orderHash = IOrderBook(orderBookAddress).submitOrder(data);
        require(orderHash == expectedOrderHash, "INVALID_ORDER_HASH");
    }

    function cancelOrder(
        bytes32 orderHash
        )
        external
    {
        bytes memory orderHashes = new bytes(32);
        assembly {
            mstore(add(orderHashes, 32), orderHash)
        }
        IOrderCanceller(orderCancellerAddress).cancelOrders(orderHashes);
    }

    function approve(
        address token,
        address spender,
        uint amount
        )
        external
    {
        require(ERC20(token).approve(spender, amount), "APPROVE_FAILED");
    }
}
