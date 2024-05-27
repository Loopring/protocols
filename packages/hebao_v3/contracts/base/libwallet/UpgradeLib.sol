// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./ApprovalLib.sol";
import "./WalletData.sol";
import "../../lib/EIP712.sol";
import "../../lib/LoopringErrors.sol";

/// @title UpgradeLib
/// @author Brecht Devos - <brecht@loopring.org>
library UpgradeLib {
    using ApprovalLib for Wallet;

    event ChangedMasterCopy(address masterCopy);
    SigRequirement public constant SIG_REQUIREMENT =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 private constant CHANGE_MASTER_COPY_TYPEHASH =
        keccak256(
            "changeMasterCopy(address wallet,uint256 validUntil,address masterCopy)"
        );

    function changeMasterCopy(address newMasterCopy) external {
        _require(newMasterCopy != address(0), Errors.INVALID_MASTER_COPY);

        emit ChangedMasterCopy(newMasterCopy);
    }

    function encodeApprovalForChangeMasterCopy(
        bytes calldata data,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        address masterCopy = abi.decode(data, (address));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    CHANGE_MASTER_COPY_TYPEHASH,
                    address(this),
                    validUntil,
                    masterCopy
                )
            )
        );
        return approvedHash;
    }
}
