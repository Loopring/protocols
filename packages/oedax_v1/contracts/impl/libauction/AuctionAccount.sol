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

import "../../iface/IAuctionData.sol";

import "../../lib/MathUint.sol";
import "../../lib/ERC20.sol";

/// @title AuctionAccount
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionAccount
{
    using MathUint  for uint;

    function depositToken(
        IAuctionData.State storage s,
        address token,
        uint    amount
        )
        internal
        returns (uint _amount)
    {
        assert(token != address(0x0));

        ERC20 erc20 = ERC20(token);
        _amount = amount
            .min(erc20.balanceOf(msg.sender))
            .min(erc20.allowance(msg.sender, address(s.oedax)));

        require(_amount > 0, "zero amount");

        require(
            s.oedax.depositToken(token, msg.sender, _amount),
            "token transfer failed"
        );
    }
}