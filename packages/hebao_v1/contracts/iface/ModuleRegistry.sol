// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;


/// @title ModuleRegistry
/// @dev A registry for modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface ModuleRegistry
{
    function registerModule(address module) external;
    function disableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
    function isModuleRegistered(address module) external view returns (bool);
    function enabledModules() external view returns (address[] memory _modules);
    function numOfEnabledModules() external view returns (uint);
}
