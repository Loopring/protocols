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

import "../iface/IExchange.sol";

import "../lib/BurnableERC20.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract BurnManager is NoDefaultFunc
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
        require(_exchangeAddress != address(0x0), ZERO_ADDRESS);
        require(_lrcAddress != address(0x0), ZERO_ADDRESS);
        exchangeAddress = _exchangeAddress;
        lrcAddress = _lrcAddress;
    }

    function burn(
        address token
        )
        external
        returns (bool)
    {
        IExchange exchange = IExchange(exchangeAddress);

        // Withdraw the complete token balance
        uint balance = exchange.burnBalances(token);
        bool success = exchange.withdrawBurned(token, balance);
        require(success, "WITHDRAWAL_FAILURE");

        // We currently only support burning LRC directly
        if (token != lrcAddress) {
            require(false, UNIMPLEMENTED);
        }

        // Burn the LRC
        require(
            BurnableERC20(lrcAddress).burn(
                balance
            ),
            BURN_FAILURE
        );

        return true;
    }

}
