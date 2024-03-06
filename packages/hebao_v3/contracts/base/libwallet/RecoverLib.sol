// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./WalletData.sol";
import "./GuardianLib.sol";
import "./LockLib.sol";
import "./Utils.sol";
import "./ApprovalLib.sol";
import "../../lib/LoopringErrors.sol";

/// @title RecoverLib
/// @author Brecht Devos - <brecht@loopring.org>
library RecoverLib {
    using GuardianLib for Wallet;
    using LockLib for Wallet;
    using Utils for address;

    event Recovered(address newOwner);
    SigRequirement public constant SIG_REQUIREMENT =
        SigRequirement.MAJORITY_OWNER_NOT_ALLOWED;

    bytes32 private constant RECOVER_TYPEHASH =
        keccak256(
            "recover(address wallet,uint256 validUntil,address newOwner,address[] newGuardians)"
        );

    /// @dev Recover a wallet by setting a new owner and guardians.
    /// @param newOwner The new owner address to set.
    /// @param newGuardians The new guardians addresses to set.
    function recover(
        Wallet storage wallet,
        address newOwner,
        address[] calldata newGuardians
    ) external {
        _require(wallet.owner != newOwner, Errors.IS_SAME_OWNER);
        _require(
            newOwner.isValidWalletOwner(),
            Errors.INVALID_NEW_WALLET_OWNER
        );

        wallet.owner = newOwner;
        wallet.setLock(address(this), false);

        if (newGuardians.length > 0) {
            for (uint i = 0; i < newGuardians.length; i++) {
                _require(
                    newGuardians[i] != newOwner,
                    Errors.INVALID_NEW_WALLET_GUARDIAN
                );
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

    function encodeApprovalForRecover(
        address newOwner,
        address[] memory newGuardians,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    RECOVER_TYPEHASH,
                    address(this),
                    validUntil,
                    newOwner,
                    keccak256(abi.encodePacked(newGuardians))
                )
            )
        );
        return approvedHash;
    }
}
