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


/// @title IExchangeV3Modules
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Modules
{
    // -- Events --
    // We need to make sure all events defined in ExchangeModules.sol
    // are aggregrated here.
    event ModuleAdded(
        address indexed moduleFactoryAddress,
        address         moduleAddress
    );

    event ModuleRemoved(
        address         moduleAddress
    );

    /// @dev Adds a module to the exchange which will be created by the given
    ///      module factory.
    ///      This method can only be called by the exchange owner.
    /// @param moduleFactoryAddress The module factory that creates the module
    ///        instance that will be used by the exchange.
    function addModule(
        address moduleFactoryAddress
        )
        external;

    /// @dev Removes the specified module from the exchange.
    ///      This method can only be called by the exchange owner.
    /// @param moduleAddress The address of the module that will be removed.
    function removeModule(
        address moduleAddress
        )
        external;

    /// @dev Returns the number of modules actively used by the exchange.
    /// @return The number of modules currently in use.
    function getNumModules()
        external
        view
        returns (uint);

    /// @dev Returns the address of the module at the specified position.
    /// @param index The index of the module
    /// @return The address of the specified module
    function getModule(uint index)
        external
        view
        returns (address);

    /// @dev Returns if the given address is an exchange module on the exchange
    /// @param exchangeModule The address to be checked
    /// @return True if the address is currently used as an exchange module, else false
    function isModule(address exchangeModule)
        external
        view
        returns (bool);
}
