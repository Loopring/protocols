// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../iface/IModule.sol";
import "../lib/ERC20.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract Version13 is IVersion
{
    address public immutable walletFactory;
    mapping (address => bool)    internal modules;
    mapping (bytes4  => address) internal methodToModule;

    constructor(
        address          _walletFactory,
        address[] memory _modules
        )
    {
        require(_walletFactory != address(0), "NULL_FACTORY");
        walletFactory = _walletFactory;

        for (uint i = 0; i < _modules.length; i++) {
            address module = _modules[i];

            require(module != address(0), "NULL_MODULE");
            modules[module] = true;

            bytes4[] memory methods = IModule(module).getBandableMethods();
            for (uint j = 0; j < methods.length; j++) {
                methodToModule[methods[j]] = module;
            }
        }
    }

    function isAuthorized(address sender, bytes4 method)
        public
        override
        view
        returns (bool)
    {
        if (method == IWallet.setOwner.selector) {
            if (IWallet(msg.sender).owner() == address(0)) {
                return sender == walletFactory;
            } else {
                return modules[sender];
            }
        }

        return modules[sender];
    }

    function getBinding(bytes4 method)
        public
        override
        view
        returns (address)
    {
        return methodToModule[method];
    }
}
