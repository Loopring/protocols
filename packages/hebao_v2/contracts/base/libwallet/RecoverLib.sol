// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./ApprovalLib.sol";
import "./WalletData.sol";
import "./LockLib.sol";
import "./Utils.sol";


/// @title RecoverLib
/// @author Brecht Devos - <brecht@loopring.org>
library RecoverLib
{
    using LockLib       for Wallet;
    using ApprovalLib   for Wallet;
    using Utils         for address;

    event Recovered(address newOwner);

    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner)"
    );

    /// @dev Recover a wallet by setting a new owner.
    /// @param approval The approval.
    /// @param newOwner The new owner address to set.
    function recover(
        Wallet   storage  wallet,
        bytes32           domainSeperator,
        Approval calldata approval,
        address           newOwner
        )
        external
    {
        require(wallet.owner != newOwner, "IS_SAME_OWNER");
        require(newOwner.isValidWalletOwner(), "INVALID_NEW_WALLET_OWNER");

        wallet.verifyApproval(
            domainSeperator,
            // SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
            approval,
            abi.encode(
                RECOVER_TYPEHASH,
                approval.wallet,
                approval.validUntil,
                newOwner
            )
        );

        if (newOwner == wallet.guardian) {//wallet.isGuardian(newOwner, true)) {
            wallet.guardian = address(0);//.deleteGuardian(newOwner, block.timestamp, true);
        }

        wallet.owner = newOwner;
        wallet.setLock(address(this), false);

        emit Recovered(newOwner);
    }
}
