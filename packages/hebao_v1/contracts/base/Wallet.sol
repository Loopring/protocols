// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../lib/ERC20.sol";
import "../lib/EIP712.sol";
import "./WalletDataLayout.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Wallet is IWallet, WalletDataLayout
{
    address public override immutable versionRegistry;

    event VersionChanged(address oldVersion, address newVersion);

    modifier asDelegatableMethod()
    {
        address _module = _getBindingTarget();
        if (_module != address(0)) {
            _delegateTo(_module);
        } else {
            _;
        }
    }

    constructor(address _versionRegistry)
    {
        versionRegistry = _versionRegistry;
    }

    function domainSeperator()
        public
        override
        view
        returns (bytes32)
    {
        string memory label = IVersion(version()).label();
        return EIP712.hash(EIP712.Domain("Loopring Wallet", label, address(this)));
    }

    function owner() public override view returns (address) { return state.owner; }
    function version() public override view returns (address) { return state.version; }

    function setVersion(address newVersion)
        external
        override
        asDelegatableMethod
    {
        address _version = version();
        require(
            newVersion != _version &&
            IVersionRegistry(versionRegistry).getVersionNumber(newVersion) > 0,
            "INVALID_VERSION_ADDRESS"
        );

        // IVersion(newVersion).migrateFrom(_version);
        state.version = newVersion;
        emit VersionChanged(_version, newVersion);
    }

    receive() external payable {}

    fallback()
        external
        payable
    {
        address _module = _getBindingTarget();
        require(_module != address(0), "NO_BINDING_FOUND");
        _delegateTo(_module);
    }

    function _delegateTo(address module)
        internal
    {
        (bool success, bytes memory returnData) = module.delegatecall(msg.data);
        assembly {
            switch success
            case 0 { revert(add(returnData, 32), mload(returnData)) }
            default { return(add(returnData, 32), mload(returnData)) }
        }
    }

    function _getBindingTarget()
        internal
        view
        returns (address)
    {
        address _version = version();
        if (_version == address(0)) {
            return address(0);
        } else {
            return IVersion(_version).getBindingTarget(msg.sig);
        }
    }
}
