// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../base/WalletDataLayout.sol";
import "../data/GuardianData.sol";
import "../data/SecurityData.sol";
import "./SecurityModule.sol";


/// @title LockModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract LockModule is SecurityModule
{
    using GuardianData  for WalletDataLayout.State;
    using SecurityData  for WalletDataLayout.State;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    event WalletLocked(address by, bool locked);

    bytes32 public constant LOCK_TYPEHASH   = keccak256("lock(uint256 validUntil)");
    bytes32 public constant UNLOCK_TYPEHASH = keccak256("unlock(uint256 validUntil)");

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](4);
        methods[0] = this.isLocked.selector;
        methods[1] = this.lock.selector;
        methods[2] = this.lockWA.selector;
        methods[3] = this.unlock.selector;
    }

    function isLocked()
        public
        view
        returns (bool)
    {
        return _isWalletLocked();
    }

    function lock()
        public
        txAwareHashNotAllowed
    {
        address payable _sender = msgSender();
        require(
            _sender == address(this) ||
            _sender == thisWallet().owner() ||
            state.isGuardian(_sender, false),
            "NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN"
        );

        _lockWallet(_sender, true);
    }

    function lockWA(
        SignedRequest.Request calldata request
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.OWNER_OR_ANY_GUARDIAN,
            request,
            abi.encode(
                LOCK_TYPEHASH,
                request.validUntil
            )
        );

        _lockWallet(request.signers[0], true);
    }

    function unlock(
        SignedRequest.Request calldata request
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                UNLOCK_TYPEHASH,
                request.validUntil
            )
        );

        _lockWallet(address(this), false);
    }

    function _lockWallet(address by, bool locked)
        internal
    {
        state.setLock(locked);
        emit WalletLocked(by, locked);
    }
}
