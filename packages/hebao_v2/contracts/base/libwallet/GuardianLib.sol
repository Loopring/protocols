// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";
import "./LockLib.sol";
import "./Utils.sol";


/// @title GuardianLib
/// @author Daniel Wang - <daniel@loopring.org>
library GuardianLib
{
    using LockLib       for Wallet;
    using ApprovalLib   for Wallet;
    using Utils         for address;

    event GuardianChanged(address newGuardian);

    bytes32 public constant GUARDIAN_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newGuardian)"
    );

    /// @dev Recover a wallet by setting a new owner.
    /// @param approval The approval.
    /// @param newGuardian The new guardian address to set.
    function setGuardianWA(
        Wallet   storage  wallet,
        bytes32           domainSeperator,
        Approval calldata approval,
        address           newGuardian
        )
        external
    {
        require(newGuardian != wallet.guardian, "IS_SAME_GUARDIAN");
        require(newGuardian != wallet.owner, "IS_SAME_AS_OWNER");
        require(newGuardian.isValidWalletGuardian(), "INVALID_NEW_WALLET_GUARDIAN");

        wallet.verifyApproval(
            domainSeperator,
            approval,
            abi.encode(
                GUARDIAN_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                newGuardian
            )
        );

        wallet.guardian = newGuardian;
        wallet.setLock(address(this), false);

        emit GuardianChanged(newGuardian);
    }
}
