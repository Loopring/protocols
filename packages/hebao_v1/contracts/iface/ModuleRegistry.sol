// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;


/// @title ModuleRegistry
/// @dev A registry for modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface ModuleRegistry
{
	/// @dev Registers and enables a new module.
    function registerModule(address module) external;

    /// @dev Disables a module
    function disableModule(address module) external;

    /// @dev Returns true if the module is registered and enabled.
    function isModuleEnabled(address module) external view returns (bool);

    /// @dev Returns the list of enabled modules.
    function enabledModules() external view returns (address[] memory _modules);

    /// @dev Returns the number of enbaled modules.
    function numOfEnabledModules() external view returns (uint);

    /// @dev Returns true if the module is ever registered.
    function isModuleRegistered(address module) external view returns (bool);
}
