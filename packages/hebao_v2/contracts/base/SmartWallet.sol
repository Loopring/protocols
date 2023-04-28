// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../iface/IEntryPoint.sol";
import "../iface/ILoopringWalletV2.sol";

import "../lib/EIP712.sol";
import "../lib/ERC20.sol";
import "../core/BaseAccount.sol";
import "../lib/ERC1271.sol";
import "../lib/ReentrancyGuard.sol";
import "../thirdparty/erc165/IERC165.sol";
import "../thirdparty/erc1155/ERC1155Holder.sol";
import "../thirdparty/erc721/ERC721Holder.sol";

import "./libwallet/ERC20Lib.sol";
import "./libwallet/ERC1271Lib.sol";
import "./libwallet/WalletData.sol";
import "./libwallet/LockLib.sol";
import "./libwallet/GuardianLib.sol";
import "./libwallet/InheritanceLib.sol";
import "./libwallet/WhitelistLib.sol";
import "./libwallet/QuotaLib.sol";
import "./libwallet/RecoverLib.sol";
import "./libwallet/UpgradeLib.sol";

/// @title SmartWallet
/// @dev Main smart wallet contract
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract SmartWallet is
    ILoopringWalletV2,
    ERC1271,
    IERC165,
    ERC721Holder,
    ERC1155Holder,
    BaseAccount
{
    using ERC20Lib for Wallet;
    using ERC1271Lib for Wallet;
    using LockLib for Wallet;
    using GuardianLib for Wallet;
    using InheritanceLib for Wallet;
    using WhitelistLib for Wallet;
    using QuotaLib for Wallet;
    using RecoverLib for Wallet;

    bytes32 public immutable DOMAIN_SEPARATOR;
    PriceOracle public immutable priceOracle;
    address public immutable blankOwner;
    IEntryPoint private immutable _entryPoint;

    // WARNING: Do not delete wallet state data to make this implementation
    // compatible with early versions.
    //
    //  ----- DATA LAYOUT BEGINS -----
    // Always needs to be first
    address internal masterCopy;

    bool internal isImplementationContract;

    Wallet public wallet;
    //  ----- DATA LAYOUT ENDS -----

    /// @dev We need to make sure the implemenation contract cannot be initialized
    ///      and used to do delegate calls to arbitrary contracts.
    modifier disableInImplementationContract() {
        require(
            !isImplementationContract,
            "DISALLOWED_ON_IMPLEMENTATION_CONTRACT"
        );
        _;
    }

    modifier onlyFromWalletOrOwnerWhenUnlocked() {
        // If the wallet's signature verfication passes, the wallet must be unlocked.
        require(
            msg.sender == address(this) ||
                (msg.sender == wallet.owner && !wallet.locked),
            "NOT_FROM_WALLET_OR_OWNER_OR_WALLET_LOCKED"
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    modifier onlyFromEntryPointWhenUnlocked() {
        require(
            msg.sender == address(entryPoint()) && !wallet.locked,
            "account: not Owner or EntryPoint"
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    modifier onlyFromEntryPoint() {
        require(
            msg.sender == address(entryPoint()) && !wallet.locked,
            "account: not Owner or EntryPoint"
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwnerWhenUnlocked() internal view {
        require(
            (msg.sender == address(entryPoint()) ||
                msg.sender == wallet.owner) && !wallet.locked,
            "account: not Owner or EntryPoint"
        );
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @inheritdoc BaseAccount
    function nonce() public view virtual override returns (uint256) {
        return wallet.nonce;
    }

    modifier canTransferOwnership() {
        require(
            msg.sender == blankOwner && wallet.owner == blankOwner,
            "NOT_ALLOWED_TO_SET_OWNER"
        );
        _;
    }

    constructor(
        PriceOracle _priceOracle,
        address _blankOwner,
        IEntryPoint entryPointInput
    ) {
        isImplementationContract = true;
        _entryPoint = entryPointInput;

        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("LoopringWallet", "2.0.0", address(this))
        );

        priceOracle = _priceOracle;
        blankOwner = _blankOwner;
    }

    /// @dev Set up this wallet.
    ///
    ///      Note that calling this method more than once will throw.
    ///
    /// @param owner The owner of this wallet, must not be address(0).
    /// @param guardians The guardians of this wallet.
    function initialize(
        address owner,
        address[] calldata guardians,
        uint quota,
        address inheritor,
        address feeRecipient,
        address feeToken,
        uint feeAmount
    ) external override disableInImplementationContract {
        require(wallet.owner == address(0), "INITIALIZED_ALREADY");
        require(owner != address(0), "INVALID_OWNER");

        wallet.owner = owner;
        wallet.creationTimestamp = uint64(block.timestamp);
        wallet.addGuardiansImmediately(guardians);

        if (quota != 0) {
            wallet.setQuota(quota, 0);
        }

        if (inheritor != address(0)) {
            wallet.setInheritor(inheritor, 365 days);
        }

        // Pay for the wallet creation using wallet funds
        if (feeRecipient != address(0) && feeAmount > 0) {
            ERC20Lib.transfer(feeToken, feeRecipient, feeAmount);
        }
    }

    receive() external payable {}

    function getOwner() public view override returns (address) {
        return wallet.owner;
    }

    function getCreationTimestamp() public view override returns (uint64) {
        return wallet.creationTimestamp;
    }

    //
    // Owner
    //
    function transferOwnership(address _owner) external canTransferOwnership {
        require(_owner != address(0), "INVALID_OWNER");
        wallet.owner = _owner;
    }

    //
    // ERC1271
    //
    function isValidSignature(
        bytes32 signHash,
        bytes memory signature
    ) public view override returns (bytes4 magicValue) {
        return wallet.isValidSignature(ERC1271_MAGICVALUE, signHash, signature);
    }

    //
    // Upgrade
    //

    function getMasterCopy() public view returns (address) {
        return masterCopy;
    }

    function isGuardian(
        address addr,
        bool includePendingAddition
    ) public view returns (bool) {
        return wallet.isGuardian(addr, includePendingAddition);
    }

    function getGuardians(
        bool includePendingAddition
    ) public view returns (Guardian[] memory) {
        return GuardianLib.guardians(wallet, includePendingAddition);
    }

    function lock() external {
        wallet.lock();
    }

    function getWhitelistEffectiveTime(
        address addr
    ) public view returns (uint) {
        return wallet.whitelisted[addr];
    }

    function isWhitelisted(address addr) public view returns (bool) {
        return wallet.isAddressWhitelisted(addr);
    }

    // ERC165
    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            interfaceId == type(ERC1271).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function changeMasterCopy(address newMasterCopy) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        UpgradeLib.changeMasterCopy(newMasterCopy);
        masterCopy = newMasterCopy;
    }

    function addGuardian(address guardian) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.addGuardian(guardian);
    }

    function removeGuardian(address guardian) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.removeGuardian(guardian);
    }

    function resetGuardians(address[] calldata newGuardians) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.resetGuardians(newGuardians);
    }

    function changeDailyQuota(uint newQuota) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.changeDailyQuota(newQuota);
    }

    function addToWhitelist(address addr) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.addToWhitelist(addr);
    }

    function removeFromWhitelist(address addr) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.removeFromWhitelist(addr);
    }

    function transferToken(
        address token,
        address to,
        uint amount,
        bytes calldata logdata,
        bool forceUseQuota
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.transferToken(
            priceOracle,
            token,
            to,
            amount,
            logdata,
            forceUseQuota
        );
    }

    function callContract(
        address to,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    ) external returns (bytes memory) {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        return wallet.callContract(priceOracle, to, value, data, forceUseQuota);
    }

    function approveToken(
        address token,
        address to,
        uint amount,
        bool forceUseQuota
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.approveToken(priceOracle, token, to, amount, forceUseQuota);
    }

    function approveThenCallContract(
        address token,
        address to,
        uint amount,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    ) external returns (bytes memory) {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        return
            wallet.approveThenCallContract(
                priceOracle,
                token,
                to,
                amount,
                value,
                data,
                forceUseQuota
            );
    }

    function setInheritor(address inheritor, uint32 waitingPeriod) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        wallet.setInheritor(inheritor, waitingPeriod);
    }

    ///////////////////////
    // only from entrypoint
    function unlock() external onlyFromEntryPoint {
        wallet.unlock();
    }

    function inherit(
        address newOwner,
        bool removeGuardians
    ) external onlyFromEntryPoint {
        wallet.inherit(newOwner, removeGuardians);
    }

    function recover(
        address newOwner,
        address[] calldata newGuardians
    ) external onlyFromEntryPoint {
        wallet.recover(newOwner, newGuardians);
    }
}
