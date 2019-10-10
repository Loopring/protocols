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

import "../../iface/modules/ICanBeDisabled.sol";


/// @title CanBeDisabled
/// @dev The CanBeDisabled contract allows the exchange owner to disable/enable the contract
/// @author Brecht Devos - <brecht@loopring.org>
contract CanBeDisabled is ICanBeDisabled
{
    modifier onlyExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    modifier whenEnabled()
    {
        require(!disabled, "INVALID_MODE");
        _;
    }

    modifier whenDisabled()
    {
        require(disabled, "INVALID_MODE");
        _;
    }

    constructor(address exchangeAddress)
        public
    {
        exchange = IExchangeV3(exchangeAddress);
    }

    function disable()
        external
        onlyExchangeOwner
        whenEnabled
    {
        disabled = true;
    }

    function enable()
        external
        onlyExchangeOwner
        whenDisabled
    {
        disabled = false;
    }
}
