// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import '../thirdparty/BytesUtil.sol';
import {SmartWallet} from './SmartWallet.sol';
import '../account-abstraction/core/BaseAccount.sol';
import '../account-abstraction/interfaces/IEntryPoint.sol';
import '../iface/PriceOracle.sol';
import './libwallet/WalletData.sol';
import './libwallet/GuardianLib.sol';
import './libwallet/RecoverLib.sol';
import './libwallet/QuotaLib.sol';
import './libwallet/RecoverLib.sol';
import '../lib/EIP712.sol';
import './libwallet/UpgradeLib.sol';
import './libwallet/WhitelistLib.sol';
import './libwallet/ApprovalLib.sol';
import './libwallet/ERC20Lib.sol';
import '../lib/SignatureUtil.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

contract SmartWalletV3 is SmartWallet {
    using SignatureUtil for bytes32;
    using ECDSA for bytes32;
    using BytesUtil for bytes;
    using ApprovalLib for Wallet;

    constructor(
        PriceOracle _priceOracle,
        address _blankOwner,
        IEntryPoint entryPointInput
    ) SmartWallet(_priceOracle, _blankOwner, entryPointInput) {}

    function selfBatchCall(
        bytes[] calldata data
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        for (uint i = 0; i < data.length; i++) {
            (bool success, ) = address(this).call(data[i]);
            require(success, 'BATCHED_CALL_FAILED');
        }
    }

    /**
     * check current account deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this account in the entryPoint
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * withdraw value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 sigTimeRange) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (userOp.callData.length >= 4) {
            bytes4 methodId = userOp.callData.toBytes4(0);
            if (isDataless(userOp)) {
                bytes memory data = userOp.callData[4:];
                (
                    Approval memory approval,
                    bytes memory ownerSignature
                ) = abi.decode(userOp.signature, (Approval, bytes));

                // then check guardians signature for actions
                if (methodId == SmartWallet.addGuardianWA.selector) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForAddGuardian(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId == SmartWallet.removeGuardianWA.selector
                ) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForRemoveGuardian(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId == SmartWallet.resetGuardiansWA.selector
                ) {
                    bytes32 approvedHash = GuardianLib
                        .encodeApprovalForResetGuardians(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId ==
                    SmartWallet.changeDailyQuotaWA.selector
                ) {
                    bytes32 approvedHash = QuotaLib
                        .encodeApprovalForChangeDailyQuota(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        QuotaLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId == SmartWallet.addToWhitelistWA.selector
                ) {
                    bytes32 approvedHash = WhitelistLib
                        .encodeApprovalForAddToWhitelist(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        WhitelistLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId == SmartWallet.transferTokenWA.selector
                ) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForTransferToken(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
                }

                if (methodId == SmartWallet.callContractWA.selector) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForCallContract(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
                }

                if (methodId == SmartWallet.approveTokenWA.selector) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForApproveToken(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId ==
                    SmartWallet.approveThenCallContractWA.selector
                ) {
                    bytes32 approvedHash = ERC20Lib
                        .encodeApprovalForApproveThenCallContract(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
                }

                if (methodId == SmartWallet.unlock.selector) {
                    bytes32 approvedHash = LockLib
                        .encodeApprovalForUnlock(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        LockLib.sigRequirement,
                        approval
                    );
                }

                if (
                    methodId == SmartWallet.changeMasterCopy.selector
                ) {
                    bytes32 approvedHash = UpgradeLib
                        .encodeApprovalForChangeMasterCopy(
                            data,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        UpgradeLib.sigRequirement,
                        approval
                    );
                }

                if (methodId == SmartWallet.recover.selector) {
                    (
                        address newOwner,
                        address[] memory newGuardians
                    ) = abi.decode(data, (address, address[]));
                    bytes32 approvedHash = RecoverLib
                        .encodeApprovalForRecover(
                            newOwner,
                            newGuardians,
                            DOMAIN_SEPARATOR,
                            approval.validUntil,
                            approval.salt
                        );
                    sigTimeRange = wallet.verifyApproval(
                        approvedHash,
                        RecoverLib.sigRequirement,
                        approval
                    );
                    if (
                        !hash.verifySignature(
                            newOwner,
                            ownerSignature
                        )
                    ) return SIG_VALIDATION_FAILED;
                }

                // check owner signature first
                // check signature of new owner when recover
                if (
                    methodId != SmartWallet.recover.selector &&
                    !hash.verifySignature(
                        wallet.owner,
                        ownerSignature
                    )
                ) {
                    return SIG_VALIDATION_FAILED;
                }

                return sigTimeRange;
            }

            if (methodId == SmartWallet.inherit.selector) {
                if (
                    hash.verifySignature(
                        wallet.inheritor,
                        userOp.signature
                    )
                ) {
                    return 0;
                }
                return SIG_VALIDATION_FAILED;
            }
        }

        require(!wallet.locked, 'wallet is locked');

        if (!hash.verifySignature(wallet.owner, userOp.signature))
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
            methodId ==
            SmartWallet.approveThenCallContractWA.selector);
    }
}
