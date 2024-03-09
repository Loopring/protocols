// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/ILoopringWalletV2.sol";
import "../account-abstraction/interfaces/IEntryPoint.sol";
import "../account-abstraction/core/BaseAccount.sol";

import "../lib/EIP712.sol";
import "../lib/ERC1271.sol";
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
import "../lib/LoopringErrors.sol";

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
    using UpgradeLib for Wallet;
    using AutomationLib for Wallet;

    bytes32 public immutable domainSeparator;
    PriceOracle public immutable priceOracle;
    address public immutable blankOwner;
    IEntryPoint internal immutable _entryPoint;
    address internal immutable connectorRegistry;

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
        _require(
            !isImplementationContract,
            Errors.DISALLOWED_ON_IMPLEMENTATION_CONTRACT
        );
        _;
    }

    modifier canTransferOwnership() {
        _require(
            msg.sender == blankOwner && wallet.owner == blankOwner,
            Errors.NOT_ALLOWED_TO_SET_OWNER
        );
        _;
    }

    modifier onlyFromEntryPoint() {
        _require(
            msg.sender == address(entryPoint()),
            Errors.ONLY_FROM_ENTRYPOINT
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    // Require the function call went through EntryPoint or wallet self or owner
    modifier onlyFromEntryPointOrWalletOrOwnerWhenUnlocked() {
        _require(
            msg.sender == address(this) ||
                ((msg.sender == address(entryPoint()) ||
                    msg.sender == wallet.owner) && !wallet.locked),
            Errors.NOT_OWNER_SELF_OR_ENTRYPOINT_OR_LOCKED
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        if (wallet.entryPoint != address(0)) {
            return IEntryPoint(wallet.entryPoint);
        }
        return _entryPoint;
    }

    constructor(
        PriceOracle _priceOracle,
        address _blankOwner,
        IEntryPoint entryPointInput,
        address _connectorRegistry
    ) {
        isImplementationContract = true;
        _require(_connectorRegistry != address(0), Errors.ZERO_ADDRESS);
        _require(address(entryPointInput) != address(0), Errors.ZERO_ADDRESS);
        _entryPoint = entryPointInput;
        connectorRegistry = _connectorRegistry;

        domainSeparator = EIP712.hash(
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
        _require(wallet.owner == address(0), Errors.INITIALIZED_ALREADY);
        _require(owner != address(0), Errors.INVALID_OWNER);

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
        _require(_owner != address(0), Errors.INVALID_OWNER);
        wallet.owner = _owner;
    }

    //
    // ERC1271
    //
    function isValidSignature(
        bytes32 signHash,
        bytes calldata signature
    ) public view override returns (bytes4 magicValue) {
        return wallet.isValidSignature(ERC1271_MAGICVALUE, signHash, signature);
    }

    //
    // Upgrade
    //

    function changeMasterCopy(
        address newMasterCopy
    ) external onlyFromEntryPoint {
        UpgradeLib.changeMasterCopy(newMasterCopy);
        masterCopy = newMasterCopy;
    }

    function getMasterCopy() public view returns (address) {
        return masterCopy;
    }

    //
    // change entrypoint
    //
    function changeEntryPoint(
        address newEntryPoint
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        _require(newEntryPoint != address(0), Errors.ZERO_ADDRESS);
        _require(
            address(entryPoint()) != newEntryPoint,
            Errors.INVALID_SAME_ENTRYPOINT
        );
        wallet.entryPoint = newEntryPoint;
    }

    //
    // Guardians
    //
    function addGuardian(
        address guardian
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.addGuardian(guardian);
    }

    function addGuardianWA(address guardian) external onlyFromEntryPoint {
        wallet.addGuardianWA(guardian);
    }

    function removeGuardian(
        address guardian
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.removeGuardian(guardian);
    }

    function removeGuardianWA(address guardian) external onlyFromEntryPoint {
        wallet.removeGuardianWA(guardian);
    }

    function resetGuardians(
        address[] calldata newGuardians
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.resetGuardians(newGuardians);
    }

    function resetGuardiansWA(
        address[] calldata newGuardians
    ) external onlyFromEntryPoint {
        wallet.resetGuardiansWA(newGuardians);
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

    //
    // Inheritance
    //

    function setInheritor(
        address inheritor,
        uint32 waitingPeriod
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.setInheritor(inheritor, waitingPeriod);
    }

    // no need to record last active time here before inherit
    function inherit(
        address newOwner,
        address[] calldata newGuardians
    ) external {
        // allow inherit from inheritor or entrypoint
        _require(
            msg.sender == address(entryPoint()) ||
                msg.sender == wallet.inheritor,
            Errors.NOT_ENTRYPOINT_OR_INHERITOR
        );
        wallet.inherit(newOwner, newGuardians);
    }

    //
    // Lock
    //

    function lock() external {
        wallet.lock(address(entryPoint()));
    }

    function unlock() external onlyFromEntryPoint {
        wallet.unlock();
    }

    //
    // Quota
    //

    function changeDailyQuota(
        uint newQuota
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.changeDailyQuota(newQuota);
    }

    function changeDailyQuotaWA(uint newQuota) external onlyFromEntryPoint {
        wallet.changeDailyQuotaWA(newQuota);
    }

    //
    // Recover
    //

    function recover(
        address newOwner,
        address[] calldata newGuardians
    ) external onlyFromEntryPoint {
        wallet.recover(newOwner, newGuardians);
    }

    //
    // Whitelist
    //

    function addToWhitelist(
        address addr
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        _require(addr != address(0), Errors.ZERO_ADDRESS);
        wallet.addToWhitelist(addr);
    }

    function addToWhitelistWA(address addr) external onlyFromEntryPoint {
        _require(addr != address(0), Errors.ZERO_ADDRESS);
        wallet.addToWhitelistWA(addr);
    }

    function removeFromWhitelist(
        address addr
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        _require(addr != address(0), Errors.ZERO_ADDRESS);
        wallet.removeFromWhitelist(addr);
    }

    function getWhitelistEffectiveTime(
        address addr
    ) public view returns (uint) {
        return wallet.whitelisted[addr];
    }

    function isWhitelisted(address addr) public view returns (bool) {
        return wallet.isAddressWhitelisted(addr);
    }

    //
    // ERC20
    //

    function transferToken(
        address token,
        address to,
        uint amount,
        bytes calldata logdata,
        bool forceUseQuota
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.transferToken(
            priceOracle,
            token,
            to,
            amount,
            logdata,
            forceUseQuota
        );
    }

    function transferTokenWA(
        address token,
        address to,
        uint amount,
        bytes calldata logdata
    ) external onlyFromEntryPoint {
        ERC20Lib.transferTokenWA(token, to, amount, logdata);
    }

    function callContract(
        address to,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    )
        external
        onlyFromEntryPointOrWalletOrOwnerWhenUnlocked
        returns (bytes memory)
    {
        return wallet.callContract(priceOracle, to, value, data, forceUseQuota);
    }

    function callContractWA(
        address to,
        uint value,
        bytes calldata data
    ) external onlyFromEntryPoint returns (bytes memory) {
        return ERC20Lib.callContractWA(to, value, data);
    }

    function approveToken(
        address token,
        address to,
        uint amount,
        bool forceUseQuota
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        wallet.approveToken(priceOracle, token, to, amount, forceUseQuota);
    }

    function approveTokenWA(
        address token,
        address to,
        uint amount
    ) external onlyFromEntryPoint {
        ERC20Lib.approveTokenWA(token, to, amount);
    }

    function approveThenCallContract(
        address token,
        address to,
        uint amount,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    )
        external
        onlyFromEntryPointOrWalletOrOwnerWhenUnlocked
        returns (bytes memory)
    {
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

    function approveThenCallContractWA(
        address token,
        address to,
        uint amount,
        uint value,
        bytes calldata data
    ) external onlyFromEntryPoint returns (bytes memory returnData) {
        returnData = ERC20Lib.approveThenCallContractWA(
            token,
            to,
            amount,
            value,
            data
        );
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

    function isExecutorOrOwner(address executor) external view returns (bool) {
        return AutomationLib.isExecutorOrOwner(wallet, executor);
    }

    function approveExecutor(
        address executor,
        uint256 validUntil
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        _require(executor != address(0), Errors.ZERO_ADDRESS);
        return AutomationLib.approveExecutor(wallet, executor, validUntil);
    }

    function unApproveExecutor(
        address executor
    ) external onlyFromEntryPointOrWalletOrOwnerWhenUnlocked {
        _require(
            AutomationLib.isExecutorOrOwner(wallet, executor),
            Errors.NOT_EXECUTOR
        );
        return AutomationLib.unApproveExecutor(wallet, executor);
    }

    function castFromEntryPoint(
        address[] calldata targets,
        bytes[] calldata datas
    ) external onlyFromEntryPoint {
        AutomationLib.cast(connectorRegistry, targets, datas);
    }

    function castFromExecutor(
        address[] calldata targets,
        bytes[] calldata datas
    ) external {
        _require(
            AutomationLib.isExecutorOrOwner(wallet, msg.sender),
            Errors.NOT_EXECUTOR
        );
        AutomationLib.cast(connectorRegistry, targets, datas);
    }
}
