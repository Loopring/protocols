// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;


import "../thirdparty/BytesUtil.sol";
import {SmartWallet} from "./SmartWallet.sol";
import  "../core/BaseAccount.sol";
import "../iface/IEntryPoint.sol";
import "../iface/PriceOracle.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


contract SmartWalletV3 is SmartWallet, BaseAccount{
    IEntryPoint private immutable _entryPoint;
   using ECDSA for bytes32;
    using BytesUtil     for bytes;
    constructor(
        PriceOracle _priceOracle,
        IEntryPoint entryPoint,
        address _blankOwner
    )SmartWallet(_priceOracle, _blankOwner){
        _entryPoint = entryPoint;
    }
    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     */
    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwnerWhenUnlocked() internal view {
        require(
            msg.sender == address(entryPoint()) || (msg.sender == wallet.owner && !wallet.locked),
            "account: not Owner or EntryPoint"
        );
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// implement template method of BaseAccount
    function _validateAndUpdateNonce(
        UserOperation calldata userOp
    ) internal override {
        if(isDataless(userOp.callData)){
            return;
        }
        require(wallet.nonce++ == userOp.nonce, "account: invalid nonce");
    }

    /// @inheritdoc BaseAccount
    function nonce() public view virtual override returns (uint256) {
        return wallet.nonce;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
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
    ) public onlyFromWalletOrOwnerWhenUnlocked {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        address
    ) internal virtual override returns (uint256 sigTimeRange) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (wallet.owner != hash.recover(userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    function isDataless(
        bytes memory data
        )
        public
        pure
        returns (bool)
    {
        // We don't require any data in the meta tx when
        // - the meta-tx has no nonce
        // - the meta-tx needs to be successful
        // - a function is called that requires a majority of guardians and fails when replayed
        bytes4 methodId = data.toBytes4(0);
        return
               (methodId == SmartWallet.changeMasterCopy.selector ||
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
