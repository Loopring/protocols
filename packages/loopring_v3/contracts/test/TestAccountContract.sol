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
pragma solidity ^0.6.6;

import "../iface/IExchangeV3.sol";

import "../lib/AddressUtil.sol";
import "../lib/MathUint.sol";


contract TestAccountContract {

    using AddressUtil       for address payable;
    using MathUint          for uint;

    IExchangeV3 exchange;

    uint[16] private dummyStorageVariables;

    modifier refund()
    {
        // Send surplus to msg.sender
        uint balanceBefore = address(this).balance.sub(msg.value);
        _;
        uint balanceAfter = address(this).balance;
        msg.sender.sendETHAndVerify(balanceAfter.sub(balanceBefore), gasleft());
    }

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchangeV3(_exchangeAddress);
    }

    function withdraw(
        address token,
        uint96 amount,
        uint24 accountID
        )
        external
        payable
        refund
    {
        //exchange.withdraw{value: msg.value}(address(this), token, amount, accountID);
    }

    receive()
        external
        payable
    {
        // Some expensive operation
        for (uint i = 0; i < 16; i++) {
            dummyStorageVariables[i] = block.number;
        }
    }
}
