// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IModule.sol";
import "../iface/IVersion.sol";
import "../lib/OwnerManagable.sol";


/// @title IVersion
/// @dev Base contract for wallet Versions.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Version1_3 is IVersion, OwnerManagable
{
    address[] public modules;
    mapping (bytes4 => address) public bindings;

    constructor(address[] memory _modules)
        OwnerManagable()
    {
        for (uint i = 0; i < _modules.length; i++) {
            address module = _modules[i];
            modules.push(module);

            bytes4[] memory methods = IModule(module).bindableMethods();
            for (uint j = 0; j < methods.length; j++) {
                require(bindings[methods[j]] == address(0), "DUPLICATE_METHOD");
                bindings[methods[j]] = module;
            }
        }
    }

    function label()
        public
        override
        pure
        returns (string memory)
    {
        return "1.3.0";
    }

    function getBindingTarget(bytes4 method)
        public
        override
        view
        returns (address)
    {
        return bindings[method];
    }

    function canInitWalletOwner(address addr)
        public
        override
        view
        returns (bool)
    {
        return isManager(addr);
    }
}
