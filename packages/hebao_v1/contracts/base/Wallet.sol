// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../lib/ERC20.sol";
import "./WalletDataLayout.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Wallet is IWallet, WalletDataLayout
{
    address public override immutable versionRegistry;

    event OwnerChanged  (address oldOwner,   address newOwner);
    event VersionChanged(address oldVersion, address newVersion);

    modifier asDelegatableMethod()
    {
        address _target = _getBindingTarget();
        if (_target != address(0)) {
            _delegateToTarget(_target);
        } else {
            _;
        }
    }

    constructor(address _versionRegistry)
    {
        versionRegistry = _versionRegistry;
    }

    function version() public override view returns (address) { return state.version; }
    function owner() public override view returns (address) { return state.owner; }

    function versionLabel()
        public
        override
        view
        returns (string memory)
    {
        return version() == address(0) ? "" : IVersion(version()).label();
    }

    function versionNumber()
        public
        override
        view
        returns (uint)
    {
        return version() == address(0) ? 0 :
            IVersionRegistry(versionRegistry).getVersionNumber(version());
    }

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

        IVersion(newVersion).migrateFrom(_version);
        state.version = newVersion;
        emit VersionChanged(_version, newVersion);
    }

    function setOwner(address newOwner)
        external
        override
        asDelegatableMethod
    {
        address _owner = owner();
        require(
            newOwner != address(0) &&
            newOwner != address(this) &&
            newOwner != _owner,
            "INVALID_OWNER_ADDRESS"
        );

        state.owner = newOwner;
        emit OwnerChanged(_owner, newOwner);
    }

    function transact(
        address  to,
        uint     value,
        bytes    calldata data
        )
        external
        override
        returns (bytes memory returnData)
    {
        // require(
        //     IVersion(version()).isAuthorized(msg.sender, msg.sig),
        //     "UNAUTHORIZED"
        // );

        // bool success;
        //     // solium-disable-next-line security/no-call-value
        // (success, returnData) = to.call{value: value}(data);


        // if (!success) {
        //     assembly {
        //         returndatacopy(0, 0, returndatasize())
        //         revert(0, returndatasize())
        //     }
        // }
    }

    receive() external payable {}

    fallback()
        external
        payable
    {
        address _target = _getBindingTarget();
        require(_target != address(0), "NO_BINDING_FOUND");
        _delegateToTarget(_target);
    }

    function _delegateToTarget(address target)
        internal
    {
        (bool success, bytes memory returnData) = target.delegatecall(msg.data);
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
