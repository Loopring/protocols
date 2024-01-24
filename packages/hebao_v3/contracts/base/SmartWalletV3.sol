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
import "./libwallet/AutomationLib.sol";
import "../lib/SignatureUtil.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SmartWalletV3 is SmartWallet {
    using SignatureUtil for bytes32;
    using ECDSA for bytes32;
    using BytesUtil for bytes;
    using ApprovalLib for Wallet;
    using AutomationLib for Wallet;

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
        if (userOp.nonce == 0 && ApprovalLib.isDataless(userOp)) {
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
        address
    ) internal virtual override returns (uint256 sigTimeRange) {
        return ApprovalLib.validateSignature(wallet, userOp, userOpHash, DOMAIN_SEPARATOR);
    }

}
