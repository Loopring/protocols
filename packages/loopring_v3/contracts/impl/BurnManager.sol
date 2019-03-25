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

pragma solidity 0.5.2;

import "../iface/IBurnManager.sol";
import "../iface/IExchange.sol";

import "../lib/BurnableERC20.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

/// @title An Implementation of IBurnManager.
/// @author Brecht Devos - <brecht@loopring.org>
contract BurnManager is IBurnManager, NoDefaultFunc
{
    using MathUint for uint;

    address public exchangeAddress = address(0x0);
    address public lrcAddress = address(0x0);

    constructor(
        address _exchangeAddress,
        address _lrcAddress
        )
        public
    {
        require(_exchangeAddress != address(0x0), "ZERO_ADDRESS");
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");
        exchangeAddress = _exchangeAddress;
        lrcAddress = _lrcAddress;
    }

    // TODO(bretch): for other tokens, we need to allow withdrawal.
    function burn(
        address token
        )
        external
        returns (bool)
    {
        // We currently only support burning LRC directly
        if (token != lrcAddress) {
            require(false, "UNIMPLEMENTED");
        }

        /*IExchange exchange = IExchange(exchangeAddress);

        // Withdraw the complete token balance
        uint balance = exchange.burnBalances(token);
        require(
            exchange.withdrawBurned(token, balance),
            "WITHDRAWAL_FAILURE"
        );

        // Burn the LRC
        require(
            BurnableERC20(lrcAddress).burn(balance),
            "BURN_FAILURE"
        );*/

        return true;
    }

}
