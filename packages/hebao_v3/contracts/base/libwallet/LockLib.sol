// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./WalletData.sol";
import "./GuardianLib.sol";
import "./ApprovalLib.sol";
import "../../lib/LoopringErrors.sol";

/// @title LockLib
/// @author Brecht Devos - <brecht@loopring.org>
library LockLib {
    using GuardianLib for Wallet;
    using ApprovalLib for Wallet;

    event WalletLocked(address by, bool locked);

    SigRequirement public constant SIG_REQUIREMENT =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 private constant UNLOCK_TYPEHASH =
        keccak256("unlock(address wallet,uint256 validUntil)");

    function lock(Wallet storage wallet, address entryPoint) public {
        _require(
            msg.sender == address(this) ||
                msg.sender == wallet.owner ||
                msg.sender == entryPoint ||
                wallet.isGuardian(msg.sender, false),
            Errors.NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN
        );
        // cannot lock wallet when no any guardian exists
        _require(wallet.numGuardians(true) > 0, Errors.NO_GUARDIANS);
        setLock(wallet, msg.sender, true);
    }

    function unlock(Wallet storage wallet) public {
        setLock(wallet, msg.sender, false);
    }

    function setLock(Wallet storage wallet, address by, bool locked) internal {
        wallet.locked = locked;
        emit WalletLocked(by, locked);
    }

    function encodeApprovalForUnlock(
        bytes memory,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(abi.encode(UNLOCK_TYPEHASH, address(this), validUntil))
        );
        return approvedHash;
    }
}
