// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";
import "./GuardianLib.sol";
import "./LockLib.sol";
import "./Utils.sol";


/// @title RecoverLib
/// @author Brecht Devos - <brecht@loopring.org>
library RecoverLib
{
    using GuardianLib   for Wallet;
    using LockLib       for Wallet;
    using ApprovalLib   for Wallet;
    using Utils         for address;

    event Recovered(address newOwner);

    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner,address[] newGuardians)"
    );

    /// @dev Recover a wallet by setting a new owner and guardians.
    /// @param approval The approval.
    /// @param newOwner The new owner address to set.
    /// @param newGuardians The new guardians addresses to set.
    function recover(
        Wallet   storage   wallet,
        bytes32            domainSeparator,
        Approval calldata  approval,
        address            newOwner,
        address[] calldata newGuardians
        )
        external
    {
        require(wallet.owner != newOwner, "IS_SAME_OWNER");
        require(newOwner.isValidWalletOwner(), "INVALID_NEW_WALLET_OWNER");

        wallet.verifyApproval(
            domainSeparator,
            SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
            approval,
            abi.encode(
                RECOVER_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                newOwner,
                keccak256(abi.encodePacked(newGuardians))
            )
        );

        wallet.owner = newOwner;
        wallet.setLock(address(this), false);

        if (newGuardians.length > 0) {
            for (uint i = 0; i < newGuardians.length; i++) {
                require(newGuardians[i] != newOwner, "INVALID_NEW_WALLET_GUARDIAN");
            }
            wallet.removeAllGuardians();
            wallet.addGuardiansImmediately(newGuardians);
        } else {
            if (wallet.isGuardian(newOwner, true)) {
                wallet.deleteGuardian(newOwner, block.timestamp, true);
            }
            wallet.cancelPendingGuardians();
        }

        emit Recovered(newOwner);
    }

}
