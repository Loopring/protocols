// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";

/// @title UpgradeLib
/// @author Brecht Devos - <brecht@loopring.org>
library UpgradeLib {
    using ApprovalLib for Wallet;

    event ChangedMasterCopy(address masterCopy);
    SigRequirement public constant sigRequirement =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 public constant CHANGE_MASTER_COPY_TYPEHASH =
        keccak256(
            "changeMasterCopy(address wallet,uint256 validUntil,address masterCopy)"
        );

    function changeMasterCopy(address newMasterCopy) external {
        require(newMasterCopy != address(0), "INVALID_MASTER_COPY");

        emit ChangedMasterCopy(newMasterCopy);
    }
}
