// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;


/// @title ModuleRegistry
/// @dev A registry for modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface ModuleRegistry
{
    function registerModule(address module) external;
    function deregisterModule(address module) external;
    function isModuleRegistered(address module) external view returns (bool);
    function modules() external view returns (address[] memory _modules);
    function numOfModules() external view returns (uint);
}
