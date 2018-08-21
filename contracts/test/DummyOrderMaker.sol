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

import "../iface/IOrderMaker.sol";
import "../iface/IOrderBook.sol";
import "../impl/OrderBook.sol";
import "../lib/Claimable.sol";

/// @author Kongliang Zhong - <kongliang@loopring.org>
contract DummyOrderMaker is IOrderMaker, Claimable {

    address public _loopringOrderBookAddress = 0x0;
    address public tokenSAddress = 0x0;
    address public tokenBAddress = 0x0;

    function setOrderBookAddress(address orderBookAddress) onlyOwner external {
        _loopringOrderBookAddress = orderBookAddress;
    }

    function setTokenSAddress(address _tokenSAddress) onlyOwner external {
        tokenSAddress = _tokenSAddress;
    }

    function setTokenBAddress(address _tokenBAddress) onlyOwner external {
        tokenBAddress = _tokenBAddress;
    }

    function makeOrder(bytes32[] dataArray)
        onlyOwner
        external
    {
        OrderBook(_loopringOrderBookAddress).submitOrder(dataArray);
    }

    function settleOrder(
        bytes32 orderHash,
        address takerAddress,
        address feeRecipient,
        uint fillAmountS
        )
        onlyOwner
        external
    {

    }

}
