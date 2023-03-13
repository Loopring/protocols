// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../iface/ILoopringWalletV2.sol";

import "../lib/EIP712.sol";
import "../lib/ERC20.sol";
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

import "../core/BaseAccount.sol";
import "./libwallet/Signatures.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SmartWallet
/// @dev Main smart wallet contract
/// @author Brecht Devos - <brecht@loopring.org>
contract SmartWallet is
    BaseAccount,
    ILoopringWalletV2,
    ERC1271,
    IERC165,
    ERC721Holder,
    ERC1155Holder
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

    using ECDSA for bytes32;

    IEntryPoint private immutable _entryPoint;
    bytes32 public immutable DOMAIN_SEPARATOR;
    PriceOracle public immutable priceOracle;
    address public immutable blankOwner;

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

    modifier canTransferOwnership() {
        require(
            msg.sender == blankOwner && wallet.owner == blankOwner,
            "NOT_ALLOWED_TO_SET_OWNER"
        );
        _;
    }

    constructor(
        PriceOracle _priceOracle,
        IEntryPoint entryPoint,
        address _blankOwner
    ) {
        isImplementationContract = true;

        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("LoopringWallet", "2.0.0", address(this))
        );

        priceOracle = _priceOracle;
        blankOwner = _blankOwner;
        _entryPoint = entryPoint;
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
        address inheritor
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

    function changeMasterCopy(
        Approval calldata approval,
        address newMasterCopy
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.changeMasterCopy(
            DOMAIN_SEPARATOR,
            approval,
            newMasterCopy
        );
        masterCopy = newMasterCopy;
    }

    function getMasterCopy() public view returns (address) {
        return masterCopy;
    }

    //
    // Guardians
    //

    function addGuardian(
        address guardian
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.addGuardian(guardian);
    }

    function addGuardianWA(
        Approval calldata approval,
        address guardian
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.addGuardianWA(
            DOMAIN_SEPARATOR,
            approval,
            guardian
        );
    }

    function removeGuardian(
        address guardian
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.removeGuardian(guardian);
    }

    function removeGuardianWA(
        Approval calldata approval,
        address guardian
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.removeGuardianWA(
            DOMAIN_SEPARATOR,
            approval,
            guardian
        );
    }

    function resetGuardians(
        address[] calldata newGuardians
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.resetGuardians(newGuardians);
    }

    function resetGuardiansWA(
        Approval calldata approval,
        address[] calldata newGuardians
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.resetGuardiansWA(
            DOMAIN_SEPARATOR,
            approval,
            newGuardians
        );
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
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.setInheritor(inheritor, waitingPeriod);
    }

    function inherit(address newOwner) external {
        wallet.inherit(newOwner);
    }

    //
    // Lock
    //

    function lock() external {
        wallet.lock();
    }

    function unlock(
        Approval calldata approval
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.unlock(DOMAIN_SEPARATOR, approval);
    }

    //
    // Quota
    //

    function changeDailyQuota(
        uint newQuota
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.changeDailyQuota(newQuota);
    }

    function changeDailyQuotaWA(
        Approval calldata approval,
        uint newQuota
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.changeDailyQuotaWA(
            DOMAIN_SEPARATOR,
            approval,
            newQuota
        );
    }

    //
    // Recover
    //

    function recover(
        Approval calldata approval,
        address newOwner,
        address[] calldata newGuardians
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.recover(
            DOMAIN_SEPARATOR,
            approval,
            newOwner,
            newGuardians
        );
    }

    //
    // Whitelist
    //

    function addToWhitelist(
        address addr
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.addToWhitelist(addr);
    }

    function addToWhitelistWA(
        Approval calldata approval,
        address addr
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.addToWhitelistWA(
            DOMAIN_SEPARATOR,
            approval,
            addr
        );
    }

    function removeFromWhitelist(
        address addr
    ) external onlyFromWalletOrOwnerWhenUnlocked {
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
    ) external onlyFromWalletOrOwnerWhenUnlocked {
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
        Approval calldata approval,
        address token,
        address to,
        uint amount,
        bytes calldata logdata
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.transferTokenWA(
            DOMAIN_SEPARATOR,
            approval,
            token,
            to,
            amount,
            logdata
        );
    }

    function callContract(
        address to,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    ) external onlyFromWalletOrOwnerWhenUnlocked returns (bytes memory) {
        return wallet.callContract(priceOracle, to, value, data, forceUseQuota);
    }

    function callContractWA(
        Approval calldata approval,
        address to,
        uint value,
        bytes calldata data
    ) external returns (bytes32 approvedHash, bytes memory returnData) {
        (approvedHash, returnData) = wallet.callContractWA(
            DOMAIN_SEPARATOR,
            approval,
            to,
            value,
            data
        );
    }

    function approveToken(
        address token,
        address to,
        uint amount,
        bool forceUseQuota
    ) external onlyFromWalletOrOwnerWhenUnlocked {
        wallet.approveToken(priceOracle, token, to, amount, forceUseQuota);
    }

    function approveTokenWA(
        Approval calldata approval,
        address token,
        address to,
        uint amount
    ) external returns (bytes32 approvedHash) {
        approvedHash = wallet.approveTokenWA(
            DOMAIN_SEPARATOR,
            approval,
            token,
            to,
            amount
        );
    }

    function approveThenCallContract(
        address token,
        address to,
        uint amount,
        uint value,
        bytes calldata data,
        bool forceUseQuota
    ) external onlyFromWalletOrOwnerWhenUnlocked returns (bytes memory) {
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
        Approval calldata approval,
        address token,
        address to,
        uint amount,
        uint value,
        bytes calldata data
    ) external returns (bytes32 approvedHash, bytes memory returnData) {
        (approvedHash, returnData) = wallet.approveThenCallContractWA(
            DOMAIN_SEPARATOR,
            approval,
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

    // execute
    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     */
    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == wallet.owner,
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
}
