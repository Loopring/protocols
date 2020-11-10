// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../lib/ERC20.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract Version13 is IVersion
{
    address public immutable walletFactory;
    mapping (address => bool   ) internal modules;
    mapping (bytes4  => address) internal methodToModule;

    constructor(
        address          _walletFactory,
        address[] memory _modules
        )
    {
        require(_walletFactory != address(0), "NULL_FACTORY");
        walletFactory = _walletFactory;

        for (uint i = 0; i < _modules.length; i++) {
            require(_modules[i] != address(0), "NULL_MODULE");
            modules[_modules[i]] = true;
        }
    }

    function isAuthorized(address sender, bytes4 method)
        public
        override
        view
        returns (bool)
    {
        if (method == IWallet.setOwner.selector) {
            address owner = IWallet(msg.sender).owner();
            if (owner == address(0)) {
                return sender == walletFactory;
            } else {
                return modules[sender];
            }
        } else {
            return modules[sender];
        }
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
