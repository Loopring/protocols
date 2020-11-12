// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

// import "../data/WhitelistData.sol";
import "./SecurityModule.sol";


/// @title GuardianModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract GuardianModule is SecurityModule
{
    uint    public constant MAX_GUARDIANS            = 10;
    uint    public constant GUARDIAN_PENDING_PERIOD  = 3 days;
    bytes32 public constant ADD_GUARDIAN_TYPEHASH    = keccak256("addGuardian(uint256 validUntil,address guardian)");
    bytes32 public constant REMOVE_GUARDIAN_TYPEHASH = keccak256("removeGuardian(uint256 validUntil,address guardian)");

    event GuardianAdded   (address guardian, uint effectiveTime);
    event GuardianRemoved (address guardian, uint effectiveTime);
    event Recovered       (address newOwner);

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](4);
        methods[0] = this.addGuardian.selector;
        methods[1] = this.addGuardianWA.selector;
        methods[2] = this.removeGuardian.selector;
        methods[3] = this.removeGuardianWA.selector;
    }

    function addGuardian(address guardian)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
        notWalletOwner(guardian)
    {
        _addGuardian(guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function addGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
        notWalletOwner(guardian)
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                ADD_GUARDIAN_TYPEHASH,
                request.validUntil,
                guardian
            )
        );

        _addGuardian(guardian, 0, true);
    }

    function removeGuardian(address guardian)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        _removeGuardian(guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function removeGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                REMOVE_GUARDIAN_TYPEHASH,
                request.validUntil,
                guardian
            )
        );

        _removeGuardian(guardian, 0, true);
    }

    function _addGuardian(
        address guardian,
        uint    pendingPeriod,
        bool    alwaysOverride
        )
        private
    {
        // address wallet = address(this);
        // require(guardian != wallet, "INVALID_ADDRESS");
        // require(guardian != address(0), "ZERO_ADDRESS");

        // SecurityStore ss = securityStore;
        // uint numGuardians = ss.numGuardians(wallet, true);
        // require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint validSince = block.timestamp;
        // if (numGuardians >= 2) {
        //     validSince = block.timestamp + pendingPeriod;
        // }
        // validSince = ss.addGuardian(wallet, guardian, validSince, alwaysOverride);
        emit GuardianAdded(guardian, validSince);
    }

    function _removeGuardian(
        address guardian,
        uint    pendingPeriod,
        bool    alwaysOverride
        )
        private
    {
        uint validUntil = block.timestamp + pendingPeriod;
        // SecurityStore ss = securityStore;
        // validUntil = ss.removeGuardian(guardian, validUntil, alwaysOverride);
        emit GuardianRemoved(guardian, validUntil);
    }
}
