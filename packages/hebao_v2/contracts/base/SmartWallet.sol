// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/EIP712.sol";
import "../lib/ERC20.sol";
import "../lib/ERC1271.sol";
import "../lib/ReentrancyGuard.sol";

import "./libwallet/ERC20Lib.sol";
import "./libwallet/ERC1271Lib.sol";
import "./libwallet/GuardianLib.sol";
import "./libwallet/WalletData.sol";
import "./libwallet/LockLib.sol";
import "./libwallet/InheritanceLib.sol";
import "./libwallet/MetaTxLib.sol";
import "./libwallet/WhitelistLib.sol";
import "./libwallet/QuotaLib.sol";
import "./libwallet/RecoverLib.sol";
import "./libwallet/UpgradeLib.sol";
import "./libwallet/Utils.sol";


/// @title SmartWallet
/// @dev Main smart wallet contract
/// @author Brecht Devos - <brecht@loopring.org>
contract SmartWallet is ERC1271
{
    using ERC20Lib          for Wallet;
    using ERC1271Lib        for Wallet;
    using GuardianLib       for Wallet;
    using LockLib           for Wallet;
    using InheritanceLib    for Wallet;
    using MetaTxLib         for Wallet;
    using WhitelistLib      for Wallet;
    using QuotaLib          for Wallet;
    using RecoverLib        for Wallet;
    using UpgradeLib        for Wallet;
    using Utils             for address;

    bytes32     public immutable DOMAIN_SEPARATOR;
    PriceOracle public immutable priceOracle;

    // WARNING: Do not delete wallet state data to make this implementation
    // compatible with early versions.
    //
    //  ----- DATA LAYOUT BEGINS -----
    // Always needs to be first
    address internal masterCopy;
    bool    internal isImplementationContract;

    Wallet public wallet;
    //  ----- DATA LAYOUT ENDS -----

    /// @dev We need to make sure the implemenation contract cannot be initialized
    ///      and used to do delegate calls to arbitrary contracts.
    modifier disableInImplementationContract
    {
        require(!isImplementationContract, "DISALLOWED_ON_IMPLEMENTATION_CONTRACT");
        _;
    }

    modifier onlyFromWalletOrOwnerWhenUnlocked()
    {
        // If the wallet's signature verfication passes, the wallet must be unlocked.
        require(
            msg.sender == address(this) ||
            (msg.sender == wallet.owner && !wallet.locked),
             "NOT_FROM_WALLET_OR_OWNER_OR_WALLET_LOCKED"
        );
        wallet.touchLastActiveWhenRequired();
        _;
    }

    constructor(
        PriceOracle _priceOracle
        )
    {
        isImplementationContract = true;

        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("LoopringWallet", "2.0.0", address(this))
        );

        priceOracle = _priceOracle;
    }

    /// @dev Set up this wallet.
    ///
    ///      Note that calling this method more than once will throw.
    ///
    /// @param owner The owner of this wallet, must not be address(0).
    /// @param guardian The guardian of this wallet.
    function initialize(
        address owner,
        address guardian,
        address feeRecipient,
        address feeToken,
        uint    feeAmount
        )
        external
        disableInImplementationContract
    {
        require(wallet.owner == address(0), "INITIALIZED_ALREADY");

        require(owner.isValidWalletOwner(), "INVALID_OWNER");
        require(guardian.isValidWalletGuardian(), "INVALID_GUARDIAN");

        wallet.owner = owner;
        wallet.guardian = guardian;

        // Pay for the wallet creation using wallet funds
        if (feeRecipient != address(0)) {
            ERC20Lib.transfer(feeToken, feeRecipient, feeAmount);
        }
    }

    receive()
        external
        payable
    {
    }

    //
    // ERC1271
    //

    function isValidSignature(
        bytes32      signHash,
        bytes memory signature
        )
        public
        view
        override
        returns (bytes4 magicValue)
    {
        return wallet.isValidSignature(
            ERC1271_MAGICVALUE,
            signHash,
            signature
        );
    }

    //
    // Upgrade
    //

    function changeMasterCopy(
        Approval calldata approval,
        address           newMasterCopy
        )
        external
    {
        masterCopy = wallet.changeMasterCopy(
            DOMAIN_SEPARATOR,
            approval,
            newMasterCopy
        );
    }

    function getMasterCopy()
        public
        view
        returns (address)
    {
        return masterCopy;
    }

    //
    // Guardian
    //

    function setGuardian(
        Approval calldata approval,
        address           newGuardian
        )
        external
    {
        wallet.setGuardianWA(DOMAIN_SEPARATOR, approval, newGuardian);
    }

    //
    // Inheritance
    //

    function setInheritor(
        address inheritor,
        uint32  waitingPeriod
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.setInheritor(inheritor, waitingPeriod);
    }

    function inherit(
        address newOwner
        )
        external
    {
        wallet.inherit(newOwner);
    }

    //
    // Lock
    //

    function lock()
        external
    {
        wallet.lock();
    }

    function unlock(
        Approval calldata approval
        )
        external
    {
        wallet.unlockWA(DOMAIN_SEPARATOR, approval);
    }

    //
    // Quota
    //

    function changeDailyQuota(
        uint newQuota
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.changeDailyQuota(newQuota);
    }

    function changeDailyQuotaWA(
        Approval calldata approval,
        uint              newQuota
        )
        external
    {
        wallet.changeDailyQuotaWA(DOMAIN_SEPARATOR, approval, newQuota);
    }

    //
    // MetaTx
    //

    function executeMetaTx(
        address to,
        uint    nonce,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        uint    gasOverhead,
        bool    requiresSuccess,
        bytes   calldata data,
        bytes   calldata signature
        )
        external
        returns (bool)
    {
        MetaTxLib.MetaTx memory metaTx = MetaTxLib.MetaTx(
            to,
            nonce,
            gasToken,
            gasPrice,
            gasLimit,
            gasOverhead,
            requiresSuccess,
            data,
            signature
        );

        return wallet.executeMetaTx(
            DOMAIN_SEPARATOR,
            priceOracle,
            metaTx
        );
    }

    function batchCall(
        address[] calldata to,
        bytes[]   calldata data
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.batchCall(to, data);
    }

    //
    // Recover
    //

    function recover(
        Approval calldata approval,
        address           newOwner
        )
        external
    {
        wallet.recoverWA(
            DOMAIN_SEPARATOR,
            approval,
            newOwner
        );
    }

    //
    // Whitelist
    //

    function addToWhitelist(
        address addr
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.addToWhitelist(addr);
    }

    function addToWhitelistWA(
        Approval calldata approval,
        address           addr
        )
        external
    {
        wallet.addToWhitelistWA(
            DOMAIN_SEPARATOR,
            approval,
            addr
        );
    }

    function removeFromWhitelist(
        address addr
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.removeFromWhitelist(addr);
    }

    function getWhitelistEffectiveTime(
        address addr
        )
        public
        view
        returns (uint)
    {
        return wallet.whitelisted[addr];
    }

    //
    // ERC20
    //

    function transferToken(
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata,
        bool           forceUseQuota
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
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
        address           token,
        address           to,
        uint              amount,
        bytes    calldata logdata
        )
        external
    {
        wallet.transferTokenWA(
            DOMAIN_SEPARATOR,
            approval,
            token,
            to,
            amount,
            logdata
        );
    }

    function callContract(
        address          to,
        uint             value,
        bytes   calldata data,
        bool             forceUseQuota
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
        returns (bytes memory)
    {
        return wallet.callContract(
            priceOracle,
            to,
            value,
            data,
            forceUseQuota
        );
    }

    function callContractWA(
        Approval calldata approval,
        address           to,
        uint              value,
        bytes    calldata data
        )
        external
        returns (bytes memory)
    {
        return wallet.callContractWA(
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
        uint    amount,
        bool    forceUseQuota
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.approveToken(
            priceOracle,
            token,
            to,
            amount,
            forceUseQuota
        );
    }

    function approveTokenWA(
        Approval calldata approval,
        address           token,
        address           to,
        uint              amount
        )
        external
    {
        wallet.approveTokenWA(
            DOMAIN_SEPARATOR,
            approval,
            token,
            to,
            amount
        );
    }

    function approveThenCallContract(
        address          token,
        address          to,
        uint             amount,
        uint             value,
        bytes   calldata data,
        bool             forceUseQuota
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
        returns (bytes memory)
    {
        return wallet.approveThenCallContract(
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
        address           token,
        address           to,
        uint              amount,
        uint              value,
        bytes    calldata data
        )
        external
        returns (bytes memory)
    {
        return wallet.approveThenCallContractWA(
            DOMAIN_SEPARATOR,
            approval,
            token,
            to,
            amount,
            value,
            data
        );
    }
}
