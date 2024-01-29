// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../../thirdparty/BytesUtil.sol";
import {SmartWallet} from "../SmartWallet.sol";
import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./GuardianLib.sol";
import "./WalletData.sol";
import "./RecoverLib.sol";
import "./QuotaLib.sol";
import "./RecoverLib.sol";
import "./UpgradeLib.sol";
import "./WhitelistLib.sol";
import "./ApprovalLib.sol";
import "./ERC20Lib.sol";
import "./AutomationLib.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../../account-abstraction/core/Helpers.sol";
import "../../account-abstraction/interfaces/UserOperation.sol";

/// @title ApprovalLib
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library ApprovalLib {
    using SignatureUtil for bytes32;
    using BytesUtil for bytes;
    using ECDSA for bytes32;
    using ApprovalLib for Wallet;

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    function verifyApproval(
        Wallet storage wallet,
        bytes32 approvedHash,
        SigRequirement sigRequirement,
        Approval memory approval
    ) internal returns (uint256) {
        // Save hash to prevent replay attacks
        require(!wallet.hashes[approvedHash], "HASH_EXIST");
        wallet.hashes[approvedHash] = true;

        if (
            approvedHash.verifySignatures(
                approval.signers,
                approval.signatures
            ) &&
            GuardianLib.requireMajority(
                wallet,
                approval.signers,
                sigRequirement
            )
        ) {
            return
                _packValidationData(
                    false,
                    approval.validUntil,
                    uint48(0) /*valid immediately*/
                );
        }
        return SIG_VALIDATION_FAILED;
    }

    struct LocalVar {
        bytes32 hash;
        bytes4 methodId;
        uint256 sigTimeRange;
    }

    /// implement template method of BaseAccount
    function validateSignature(
        Wallet storage wallet,
        UserOperation calldata userOp,
        bytes32 userOpHash,
        bytes32 domainSeparator
    ) public returns (uint256) {
        LocalVar memory localVar;
        localVar.hash = userOpHash.toEthSignedMessageHash();
        if (userOp.callData.length >= 4) {
            localVar.methodId = userOp.callData.toBytes4(0);
            if (isDataless(userOp)) {
                bytes memory data = userOp.callData[4:];
                (Approval memory approval, bytes memory ownerSignature) = abi
                    .decode(userOp.signature, (Approval, bytes));

                // then check guardians signature for actions
                if (localVar.methodId == SmartWallet.addGuardianWA.selector) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForAddGuardian(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId == SmartWallet.removeGuardianWA.selector
                ) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForRemoveGuardian(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId == SmartWallet.resetGuardiansWA.selector
                ) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForResetGuardians(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId == SmartWallet.changeDailyQuotaWA.selector
                ) {
                    bytes32 approvedHash = QuotaLib
                        .encodeApprovalForChangeDailyQuota(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        QuotaLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId == SmartWallet.addToWhitelistWA.selector
                ) {
                    bytes32 approvedHash = WhitelistLib
                        .encodeApprovalForAddToWhitelist(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        WhitelistLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (localVar.methodId == SmartWallet.transferTokenWA.selector) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForTransferToken(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (localVar.methodId == SmartWallet.callContractWA.selector) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForCallContract(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (localVar.methodId == SmartWallet.approveTokenWA.selector) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForApproveToken(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId ==
                    SmartWallet.approveThenCallContractWA.selector
                ) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForApproveThenCallContract(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (localVar.methodId == SmartWallet.unlock.selector) {
                    bytes32 approvedHash = LockLib.encodeApprovalForUnlock(
                        data,
                        domainSeparator,
                        approval.validUntil
                    );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        LockLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (
                    localVar.methodId == SmartWallet.changeMasterCopy.selector
                ) {
                    bytes32 approvedHash = UpgradeLib
                        .encodeApprovalForChangeMasterCopy(
                            data,
                            domainSeparator,
                            approval.validUntil
                        );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        UpgradeLib.SIG_REQUIREMENT,
                        approval
                    );
                }

                if (localVar.methodId == SmartWallet.recover.selector) {
                    (address newOwner, address[] memory newGuardians) = abi
                        .decode(data, (address, address[]));
                    bytes32 approvedHash = RecoverLib.encodeApprovalForRecover(
                        newOwner,
                        newGuardians,
                        domainSeparator,
                        approval.validUntil
                    );
                    localVar.sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        RecoverLib.SIG_REQUIREMENT,
                        approval
                    );
                    if (
                        !localVar.hash.verifySignature(newOwner, ownerSignature)
                    ) return SIG_VALIDATION_FAILED;
                }

                // check owner signature first
                // check signature of new owner when recover
                if (
                    localVar.methodId != SmartWallet.recover.selector &&
                    !localVar.hash.verifySignature(wallet.owner, ownerSignature)
                ) {
                    return SIG_VALIDATION_FAILED;
                }

                return localVar.sigTimeRange;
            }

            if (localVar.methodId == SmartWallet.inherit.selector) {
                if (
                    localVar.hash.verifySignature(
                        wallet.inheritor,
                        userOp.signature
                    )
                ) {
                    return 0;
                }
                return SIG_VALIDATION_FAILED;
            }

            if (localVar.methodId == SmartWallet.castFromEntryPoint.selector) {
                // automation can be used only when wallet is unlocked
                require(!wallet.locked, "wallet is locked");
                address executor = localVar.hash.recover(userOp.signature);
                if (AutomationLib.isExecutorOrOwner(wallet, executor)) {
                    return 0;
                }
                return SIG_VALIDATION_FAILED;
            }
        }

        require(!wallet.locked, "wallet is locked");

        if (!localVar.hash.verifySignature(wallet.owner, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    function isDataless(
        UserOperation calldata userOp
    ) internal pure returns (bool) {
        // We don't require any data in the meta tx when
        // - the meta-tx has no nonce
        // - the meta-tx needs to be successful
        // - a function is called that requires a majority of guardians and fails when replayed
        bytes4 methodId = userOp.callData.toBytes4(0);
        return (methodId == SmartWallet.changeMasterCopy.selector ||
            methodId == SmartWallet.addGuardianWA.selector ||
            methodId == SmartWallet.removeGuardianWA.selector ||
            methodId == SmartWallet.resetGuardiansWA.selector ||
            methodId == SmartWallet.unlock.selector ||
            methodId == SmartWallet.changeDailyQuotaWA.selector ||
            methodId == SmartWallet.recover.selector ||
            methodId == SmartWallet.addToWhitelistWA.selector ||
            methodId == SmartWallet.transferTokenWA.selector ||
            methodId == SmartWallet.callContractWA.selector ||
            methodId == SmartWallet.approveTokenWA.selector ||
            methodId == SmartWallet.approveThenCallContractWA.selector);
    }
}
