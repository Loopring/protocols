// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {SmartWallet} from "./SmartWallet.sol";
import "../account-abstraction/core/BaseAccount.sol";
import "../account-abstraction/interfaces/IEntryPoint.sol";
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
import "../lib/LoopringErrors.sol";

contract SmartWalletV3 is SmartWallet {
    constructor(
        PriceOracle _priceOracle,
        address _blankOwner,
        IEntryPoint entryPointInput,
        address connectorRegistry
    )
        SmartWallet(
            _priceOracle,
            _blankOwner,
            entryPointInput,
            connectorRegistry
        )
    {}

    function selfBatchCall(
        bytes[] calldata data
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        for (uint i = 0; i < data.length; i++) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = address(this).call(data[i]);
            _require(success, Errors.BATCHED_CALL_FAILED);
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
        return
            ApprovalLib.validateSignature(
                wallet,
                userOp,
                userOpHash,
                domainSeparator
            );
    }
}
