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
pragma experimental ABIEncoderV2;

import "../libexchange/ExchangeModules.sol";

import "./ExchangeV3Core.sol";


/// @title IExchangeV3Tokens
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Modules is IExchangeV3Modules, ExchangeV3Core
{
    using ExchangeModules    for ExchangeData.State;

    function addModule(
        address moduleFactoryAddress
        )
        external
        onlyOwner
    {
        state.addModule(moduleFactoryAddress);
    }

    function removeModule(
        address moduleAddress
        )
        external
        onlyOwner
    {
        state.removeModule(moduleAddress);
    }

    function getNumModules()
        external
        view
        returns (uint)
    {
        return state.modules.length;
    }

    function getModule(uint index)
        external
        view
        returns (address)
    {
        return address(state.modules[index].module);
    }

    function isModule(address exchangeModule)
        external
        view
        returns (bool)
    {
        return state.addressToModuleMap[exchangeModule] > 0;
    }
}