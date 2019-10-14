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
pragma solidity ^0.5.11;

import "../lib/AddressUtil.sol";
import "../lib/MathUint.sol";


/// @title Refundable
/// @author Brecht Devos - <brecht@loopring.org>
contract Refundable
{
    using AddressUtil       for address payable;
    using MathUint          for uint;

    /// @dev Pays back any additional ETH in the contract after executing the function
    modifier refund()
    {
        // Store the balance before
        uint _balanceBefore = address(this).balance.sub(msg.value);
        _;
        // Send any surplus back to msg.sender
        uint _balanceAfter = address(this).balance;
        msg.sender.sendETHAndVerify(_balanceAfter.sub(_balanceBefore), gasleft());
    }
}
