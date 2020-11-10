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
contract Wallet is IWallet
{
    // WARNING: do not delete wallet state data to make this implementation
    // compatible with early versions.
    //
    //  ----- DATA LAYOUT BEGINS -----
    address public override immutable versionRegistry;
    address public override owner;
    address public override version;

    //  ----- DATA LAYOUT ENDS -----

    event OwnerChanged  (address oldOwner,   address newOwner);
    event VersionChanged(address oldVersion, address newVersion);

    constructor(address _versionRegistry)
    {
        versionRegistry = _versionRegistry;
    }

    function setVersion(address newVersion)
        external
        override
    {
        require(
            newVersion != version &&
            IVersionRegistry(versionRegistry).getVersionNumber(newVersion) > 0,
            "INVALID_VERSION_ADDRESS"
        );
        require(
            version == address(0) ||
            IVersion(version).isAuthorized(msg.sender, msg.sig),
            "UNAUTHORIZED"
        );
        IVersion(newVersion).migrateFrom(version);
        emit VersionChanged(version, newVersion);
        version = newVersion;
    }

    function setOwner(address newOwner)
        external
        override
    {
        require(
            newOwner != address(0) &&
            newOwner != address(this) &&
            newOwner != owner,
            "INVALID_OWNER_ADDRESS"
        );

        require(
            IVersion(version).isAuthorized(msg.sender, msg.sig),
            "UNAUTHORIZED"
        );
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function transact(
        uint8    mode,
        address  to,
        uint     value,
        bytes    calldata data
        )
        external
        override
        returns (bytes memory returnData)
    {
        require(
            IVersion(version).isAuthorized(msg.sender, msg.sig),
            "UNAUTHORIZED"
        );

        bool success;
        if (mode == 1) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.call{value: value}(data);
        } else if (mode == 2) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.delegatecall(data);
        } else if (mode == 3) {
            require(value == 0, "INVALID_VALUE");
            // solium-disable-next-line security/no-call-value
            (success, returnData) = to.staticcall(data);
        } else {
            revert("UNSUPPORTED_MODE");
        }

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    receive() external payable {}

    /// @dev This default function can receive Ether or perform queries to modules
    ///      using bound methods.
    fallback()
        external
        payable
    {
        address target = IVersion(version).getBinding(msg.sig);
        require(target != address(0), "NO_BINDING_FOUND");

        (bool success, bytes memory returnData) = target.call{value: msg.value}(msg.data);
        assembly {
            switch success
            case 0 { revert(add(returnData, 32), mload(returnData)) }
            default { return(add(returnData, 32), mload(returnData)) }
        }
    }
}
