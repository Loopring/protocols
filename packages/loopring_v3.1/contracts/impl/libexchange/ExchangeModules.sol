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

import "../../lib/MathUint.sol";

import "../../iface/exchangev3/IExchangeV3Modules.sol";
import "../../iface/IExchangeModuleFactory.sol";

import "./ExchangeData.sol";
import "./ExchangeStatus.sol";


/// @title ExchangeMaintenance.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeModules
{
    using MathUint          for uint;
    using ExchangeStatus    for ExchangeData.State;

    event ModuleAdded(
        address indexed moduleFactoryAddress,
        address         moduleAddress
    );

    event ModuleRemoved(
        address         moduleAddress
    );

    function addModule(
        ExchangeData.State storage state,
        address moduleFactoryAddress
        )
        external
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(!state.isShutdown(), "INVALID_MODE");

        // Create the module instance
        address moduleInstance = IExchangeModuleFactory(moduleFactoryAddress).createModule(address(this));
        require(state.addressToModuleMap[moduleInstance] == 0, "MODULE_ALREADY_REGISTERED");

        // Add the module
        IExchangeModule moduleContract = IExchangeModule(moduleInstance);
        ExchangeData.Module memory module = ExchangeData.Module(
            moduleContract
        );
        state.modules.push(module);
        state.addressToModuleMap[moduleInstance] = state.modules.length;

        emit ModuleAdded(moduleFactoryAddress, moduleInstance);
    }

    function removeModule(
        ExchangeData.State storage state,
        address moduleAddress
        )
        external
    {
        require(state.addressToModuleMap[moduleAddress] != 0, "MODULE_NOT_REGISTERED");
        uint moduleIdx = state.addressToModuleMap[moduleAddress] - 1;

        ExchangeData.Module storage module = state.modules[moduleIdx];
        bool canBeRemoved = module.module.onRemove();
        require(canBeRemoved, "MODULE_CANNOT_BE_REMOVED");

        // Swap with the last module (if the module we're removing isn't already the last module)
        if (moduleIdx != state.modules.length - 1) {
            state.modules[moduleIdx] = state.modules[state.modules.length - 1];
            state.addressToModuleMap[address(state.modules[moduleIdx].module)] = moduleIdx;
        }
        state.modules.length--;
        state.addressToModuleMap[moduleAddress] = 0;

        emit ModuleRemoved(address(module.module));
    }

    function getAggregatedModulesStatus(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool aggregatedNeedsWithdrawalMode, bool aggregatedHasOpenRequests)
    {
        // It is critical that this function doesn't fail and doesn't use a lot of gas
        // because we depend on it for allowing users to withdraw funds directly from the exchange.
        // If this function fails or uses too much gas that isn't possible.
        uint gasLimit = ExchangeData.MAX_GAS_USE_MODULE_STATUS_CHECKING() < gasleft() ?
            gasleft() : ExchangeData.MAX_GAS_USE_MODULE_STATUS_CHECKING();
        for(uint i = 0; i < S.modules.length; i++) {
            uint gasBefore = gasleft();
            bytes memory callData = abi.encodeWithSelector(
                S.modules[i].module.getStatus.selector
            );
            (bool success, bytes memory data) = address(S.modules[i].module).staticcall.gas(gasLimit)(callData);
            if (!success) {
                aggregatedNeedsWithdrawalMode = true;
            } else {
                (bool needsWithdrawalMode, bool hasOpenRequests, ) = abi.decode(data, (bool, bool, uint));
                aggregatedNeedsWithdrawalMode = aggregatedNeedsWithdrawalMode || needsWithdrawalMode;
                aggregatedHasOpenRequests = aggregatedHasOpenRequests || hasOpenRequests;
            }
            // Lower the gas limit by subtracting the gas used in this iteration
            uint gasAfter = gasleft();
            uint gasDelta = gasBefore - gasAfter;
            gasLimit = gasLimit > gasDelta ? gasLimit - gasDelta : 0;
        }
    }
}
