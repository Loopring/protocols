// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SignedRequest.sol";
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
    using SignedRequest for Wallet;
    using Utils         for address;

    event Recovered(address newOwner);

    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner)"
    );

    /// @dev Recover a wallet by setting a new owner.
    /// @param request The general request object.
    /// @param newOwner The new owner address to set.
    function recover(
        Wallet  storage  wallet,
        bytes32          domainSeperator,
        Request calldata request,
        address          newOwner
        )
        external
    {
        require(wallet.owner != newOwner, "IS_SAME_OWNER");
        require(newOwner.isValidWalletOwner(), "INVALID_NEW_WALLET_OWNER");

        wallet.verifyRequest(
            domainSeperator,
            SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
            request,
            abi.encode(
                RECOVER_TYPEHASH,
                request.wallet,
                request.validUntil,
                newOwner
            )
        );

        if (wallet.isGuardian(newOwner, true)) {
            wallet.deleteGuardian(newOwner, block.timestamp, true);
        }

        wallet.owner = newOwner;
        wallet.setLock(address(this), false);
        wallet.cancelPendingGuardians();

        emit Recovered(newOwner);
    }
}