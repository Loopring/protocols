// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../thirdparty/BytesUtil.sol";
import {SmartWallet} from "./SmartWallet.sol";
import "../core/BaseAccount.sol";
import "../iface/IEntryPoint.sol";
import "../iface/PriceOracle.sol";
import "./libwallet/WalletData.sol";
import "./libwallet/GuardianLib.sol";
import "./libwallet/RecoverLib.sol";
import "./libwallet/QuotaLib.sol";
import "./libwallet/RecoverLib.sol";
import "../lib/EIP712.sol";
import "./libwallet/UpgradeLib.sol";
import "./libwallet/WhitelistLib.sol";
import "./libwallet/ApprovalLib.sol";
import "./libwallet/ERC20Lib.sol";
import "../lib/SignatureUtil.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

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
            require(success, "BATCHED_CALL_FAILED");
        }
    }

    /// implement template method of BaseAccount
    function _validateAndUpdateNonce(
        UserOperation calldata userOp
    ) internal override {
        if (userOp.nonce == 0 && isDataless(userOp)) {
            return;
        }
        require(
            userOp.nonce > wallet.nonce &&
                (userOp.nonce >> 128) <= block.number,
            "invalid nonce"
        );
        // update nonce
        wallet.nonce = userOp.nonce;
    }

    function _call(address target, uint256 value, bytes memory data) internal { // 这个 internal 在哪里有调用
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
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
        bytes32 userOpHash,
        address  // aggregator 做签名聚合的还没实现
    ) internal virtual override returns (uint256 sigTimeRange) { // 这里不应该是 virtual 的方法吧？
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        bytes4 methodId = userOp.callData.toBytes4(0);
        if (methodId == SmartWallet.addGuardianWA.selector) {
            return
                wallet.verifyApproval( // 少了domainSeparator
                    GuardianLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.removeGuardianWA.selector) {
            return
                wallet.verifyApproval(
                    GuardianLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.resetGuardiansWA.selector) {
            return
                wallet.verifyApproval(
                    GuardianLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.changeDailyQuotaWA.selector) {
            return
                wallet.verifyApproval(
                    QuotaLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.addToWhitelistWA.selector) {
            return
                wallet.verifyApproval(
                    WhitelistLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.transferTokenWA.selector) {
            return
                wallet.verifyApproval(
                    ERC20Lib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.callContractWA.selector) {
            return
                wallet.verifyApproval(
                    ERC20Lib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.approveTokenWA.selector) {
            return
                wallet.verifyApproval(
                    ERC20Lib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.approveThenCallContractWA.selector) {
            return
                wallet.verifyApproval(
                    ERC20Lib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.unlock.selector) {
            return
                wallet.verifyApproval(
                    LockLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.changeMasterCopy.selector) {
            return
                wallet.verifyApproval(
                    UpgradeLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.recover.selector) {
            return
                wallet.verifyApproval(
                    RecoverLib.sigRequirement,
                    userOpHash,
                    userOp.signature
                );
        }

        if (methodId == SmartWallet.inherit.selector) {
            if (hash.verifySignature(wallet.inheritor, userOp.signature)) {
                return 0;
            }
            return SIG_VALIDATION_FAILED;
        }

        require(!wallet.locked, "wallet is locked"); // 这个移到前面是不是可以减少计算成本？

        if (!hash.verifySignature(wallet.owner, userOp.signature)) // 如果是从entry point来的guardian发的lock请求，将无法进行lock
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
