// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";


/// @title LockLib
/// @author Brecht Devos - <brecht@loopring.org>
library LockLib
{
    using ApprovalLib   for Wallet;

    event WalletLocked (
        address         by,
        bool            locked
    );

    bytes32 public constant LOCK_TYPEHASH = keccak256(
        "lock(address wallet,uint256 validUntil)"
    );
    bytes32 public constant UNLOCK_TYPEHASH = keccak256(
        "unlock(address wallet,uint256 validUntil)"
    );

    function lock(Wallet storage wallet)
        public
    {
        require(
            msg.sender == address(this) ||
            msg.sender == wallet.owner ||
            msg.sender == wallet.guardian,
            "NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN"
        );

        setLock(wallet, msg.sender, true);
    }

    function unlock(
        Wallet   storage  wallet,
        bytes32           domainSeperator,
        Approval calldata approval
        )
        public
    {
        wallet.verifyApproval(
            domainSeperator,
            // SigRequirement.MAJORITY_OWNER_REQUIRED,
            approval,
            abi.encode(
                UNLOCK_TYPEHASH,
                approval.wallet,
                approval.validUntil
            )
        );

        setLock(wallet, msg.sender, false);
    }

    function setLock(
        Wallet storage wallet,
        address        by,
        bool           locked
        )
        internal
    {
        wallet.locked = true;
        emit WalletLocked(by, locked);
    }
}
