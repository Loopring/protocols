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


/// @title Utility Functions for addresses
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library AddressUtil
{
    using AddressUtil for *;

    function isContract(
        address addr
        )
        internal
        view
        returns (bool)
    {
        uint32 size;
        assembly { size := extcodesize(addr) }
        return (size > 0);
    }

    function toPayable(
        address addr
        )
        internal
        pure
        returns (address payable)
    {
        return payable(addr);
    }

    // Works like address.send but with a customizable gas limit
    // Make sure your code is safe for reentrancy when using this function!
    function sendETH(
        address to,
        uint    amount,
        uint    gasLimit
        )
        internal
        returns (bool success)
    {
        if (amount == 0) {
            return true;
        }
        address payable recipient = to.toPayable();
        /* solium-disable-next-line */
        (success, ) = recipient.call{value: amount, gas: gasLimit}("");
    }

    // Works like address.transfer but with a customizable gas limit
    // Make sure your code is safe for reentrancy when using this function!
    function sendETHAndVerify(
        address to,
        uint    amount,
        uint    gasLimit
        )
        internal
        returns (bool success)
    {
        success = to.sendETH(amount, gasLimit);
        require(success, "TRANSFER_FAILURE");
    }
}
