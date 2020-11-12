// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../data/WhitelistData.sol";
import "./SecurityModule.sol";



/// @title RecoveryModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract RecoveryModule is SecurityModule
{
    using GuardianData  for WalletDataLayout.State;
    using SecurityData  for WalletDataLayout.State;
    using SignatureUtil for bytes32;

    event OwnerChanged (address prevOwner, address newOwner);

    bytes32 public constant RECOVER_TYPEHASH = keccak256("recover(uint256 validUntil,address newOwner)");

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.setOwner.selector;
        methods[1] = this.recover.selector;
    }

    function setOwner(address newOwner)
        external
        eligibleWalletOwner(newOwner)
    {
        address prevOwner = state.owner;
        require(prevOwner == address(0), "INITIALIZED_ALREADY");
        state.owner = newOwner;
        emit OwnerChanged(prevOwner, newOwner);
    }

    /// @dev Recover a wallet by setting a new owner.
    /// @param request The general request object.
    /// @param newOwner The new owner address to set.
    function recover(
        SignedRequest.Request calldata request,
        address newOwner
        )
        external
        eligibleWalletOwner(newOwner)
        notWalletOwner(newOwner)
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
            request,
            abi.encode(
                RECOVER_TYPEHASH,
                request.validUntil,
                newOwner
            )
        );

        if (state.isGuardian(newOwner, true)) {
            state.removeGuardian(newOwner, block.timestamp, true);
        }

        state.cancelPendingGuardians();
        state.setLock(false);
        emit OwnerChanged(state.owner, newOwner);
        state.owner = newOwner;
    }
}
