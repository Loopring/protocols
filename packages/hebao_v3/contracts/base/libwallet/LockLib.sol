// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import './WalletData.sol';
import './GuardianLib.sol';
import './ApprovalLib.sol';

/// @title LockLib
/// @author Brecht Devos - <brecht@loopring.org>
library LockLib {
    using GuardianLib for Wallet;
    using ApprovalLib for Wallet;

    event WalletLocked(address by, bool locked);

    SigRequirement public constant sigRequirement =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 public constant UNLOCK_TYPEHASH =
        keccak256(
            'unlock(address wallet,uint256 validUntil,bytes32 salt)'
        );

    function lock(Wallet storage wallet, address entryPoint) public {
        require(
            msg.sender == address(this) ||
                msg.sender == wallet.owner ||
                msg.sender == entryPoint ||
                wallet.isGuardian(msg.sender, false),
            'NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN'
        );
        setLock(wallet, msg.sender, true);
    }

    function unlock(Wallet storage wallet) public {
        setLock(wallet, msg.sender, false);
    }

    function setLock(
        Wallet storage wallet,
        address by,
        bool locked
    ) internal {
        wallet.locked = locked;
        emit WalletLocked(by, locked);
    }

    function encodeApprovalForUnlock(
        bytes memory,
        bytes32 domainSeparator,
        uint256 validUntil,
        bytes32 salt
    ) external view returns (bytes32) {
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    UNLOCK_TYPEHASH,
                    address(this),
                    validUntil,
                    salt
                )
            )
        );
        return approvedHash;
    }
}
