// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";


/// @title MigrationModule
/// @author Daniel Wang - <daniel@loopring.org>
contract MigrationModule is SecurityModule
{
    event VersionChanged(address prevVersion, address newVersion);

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.setVersion.selector;
        methods[1] = this.migrate.selector;
    }

    function setVersion(address newVersion)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        address prevVersion = thisWallet().version();
        require(newVersion != prevVersion, "SAME_VERSION");

        IVersionRegistry registry = IVersionRegistry(thisWallet().versionRegistry());
        require(registry.getVersionNumber(newVersion) > 0, "INVALID_VERSION_ADDRESS");

        MigrationModule(this).migrate(prevVersion, newVersion);

        state.version = newVersion;
        emit VersionChanged(prevVersion, newVersion);
    }

    function migrate(address prevVersion, address newVersion)
        external
    {
        require(msg.sender == address(this), "PROHOBITED");
        require(prevVersion != newVersion, "UNEXPECTED");
        // Migration from old version to new version can be done here.
    }
}
