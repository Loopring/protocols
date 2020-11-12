// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../base/WalletDataLayout.sol";
import "../data/GuardianData.sol";
import "../data/SecurityData.sol";
import "./SecurityModule.sol";


/// @title LockModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract MigrationModule is SecurityModule
{
    using SecurityData  for WalletDataLayout.State;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    event VersionChanged(address prevVersion, address newVersion);

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.setVersion.selector;
        // methods[0] = this.migrate.selector;
    }

    // function migrate(address prevVersion, address newVersion)
    //     external
    // {
    //     require(msg.sender == address(this), "PROHOBITED");
    // }

    function setVersion(address newVersion)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        address prevVersion = thisWallet().version();
        require(newVersion != prevVersion, "SAME_VERSION");

        IVersionRegistry registry = IVersionRegistry(thisWallet().versionRegistry());
        require(registry.getVersionNumber(newVersion) > 0, "INVALID_VERSION_ADDRESS");

        // migrate(prevVersion, newVersion);

        state.version = newVersion;
        emit VersionChanged(prevVersion, newVersion);
    }
}
