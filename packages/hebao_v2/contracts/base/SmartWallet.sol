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
import "./libwallet/WalletData.sol";
import "./libwallet/LockLib.sol";
import "./libwallet/GuardianLib.sol";
import "./libwallet/InheritanceLib.sol";
import "./libwallet/MetaTxLib.sol";
import "./libwallet/WhitelistLib.sol";
import "./libwallet/QuotaLib.sol";
import "./libwallet/RecoverLib.sol";
import "./libwallet/UpgradeLib.sol";


/// @title SmartWallet
/// @dev Main smart wallet contract
/// @author Brecht Devos - <brecht@loopring.org>
contract SmartWallet is ERC1271
{
    using ERC20Lib          for Wallet;
    using ERC1271Lib        for Wallet;
    using LockLib           for Wallet;
    using GuardianLib       for Wallet;
    using InheritanceLib    for Wallet;
    using MetaTxLib         for Wallet;
    using WhitelistLib      for Wallet;
    using QuotaLib          for Wallet;
    using RecoverLib        for Wallet;
    using UpgradeLib        for Wallet;

    bytes32     public immutable DOMAIN_SEPARATOR;
    PriceOracle public immutable priceOracle;
    address     public immutable blankOwner;

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

    modifier canTransferOwnership()
    {
        require(
            msg.sender == blankOwner &&
            wallet.owner == blankOwner,
            "NOT_ALLOWED_TO_SET_OWNER"
        );
        _;
    }

    constructor(
        PriceOracle _priceOracle,
        address     _blankOwner
        )
    {
        isImplementationContract = true;

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
        address             owner,
        address[] calldata  guardians,
        uint                quota,
        address             inheritor,
        address             feeRecipient,
        address             feeToken,
        uint                feeAmount
        )
        external
        disableInImplementationContract
    {
        require(wallet.owner == address(0), "INITIALIZED_ALREADY");
        require(owner != address(0), "INVALID_OWNER");

        wallet.owner = owner;
        wallet.addGuardiansImmediately(guardians);

        if (quota != 0) {
            wallet.setQuota(quota, 0);
        }

        if (inheritor != address(0)) {
            wallet.setInheritor(inheritor, 365 days);
        }

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
    // Owner
    //
    function transferOwnership(
        address _owner
        )
        external
        canTransferOwnership
    {
        require(_owner != address(0), "INVALID_OWNER");
        wallet.owner = _owner;
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.changeMasterCopy(
            DOMAIN_SEPARATOR,
            approval,
            newMasterCopy
        );
        masterCopy = newMasterCopy;
    }

    function getMasterCopy()
        public
        view
        returns (address)
    {
        return masterCopy;
    }

    //
    // Guardians
    //

    function addGuardian(
        address guardian
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.addGuardian(guardian);
    }

    function addGuardianWA(
        Approval calldata approval,
        address           guardian
        )
        external
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.addGuardianWA(DOMAIN_SEPARATOR, approval, guardian);
    }

    function removeGuardian(
        address guardian
        )
        external
        onlyFromWalletOrOwnerWhenUnlocked
    {
        wallet.removeGuardian(guardian);
    }

     function removeGuardianWA(
        Approval calldata approval,
        address           guardian
        )
        external
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.removeGuardianWA(DOMAIN_SEPARATOR, approval, guardian);
    }

     function resetGuardians(
         address[] calldata newGuardians
         )
         external
         onlyFromWalletOrOwnerWhenUnlocked
     {
         wallet.resetGuardians(newGuardians);
     }

     function resetGuardiansWA(
         Approval  calldata approval,
         address[] calldata newGuardians
         )
         external
     {
         wallet.resetGuardiansWA(DOMAIN_SEPARATOR, approval, newGuardians);
     }

     function isGuardian(address addr, bool includePendingAddition)
         public
         view
         returns (bool)
     {
         return wallet.isGuardian(addr, includePendingAddition);
     }

     function getGuardians(bool includePendingAddition)
         public
         view
         returns (Guardian[] memory )
     {
         return GuardianLib.guardians(wallet, includePendingAddition);
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.unlock(DOMAIN_SEPARATOR, approval);
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.changeDailyQuotaWA(DOMAIN_SEPARATOR, approval, newQuota);
    }

    //
    // MetaTx
    //

    function executeMetaTx(
        address to,
        uint    nonce,
        uint    validUntil,
        address gasToken,
        uint    gasPrice,
        uint    gasLimit,
        uint    gasOverhead,
        address feeRecipient,
        bool    requiresSuccess,
        bytes   calldata data,
        bytes   memory   signature
        )
        external
        returns (bool)
    {
        MetaTxLib.MetaTx memory metaTx = MetaTxLib.MetaTx(
            to,
            nonce,
            validUntil,
            gasToken,
            gasPrice,
            gasLimit,
            gasOverhead,
            feeRecipient,
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
        Approval calldata  approval,
        address            newOwner,
        address[] calldata newGuardians
        )
        external
        returns (bytes32 approvedHash)
    {
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.addToWhitelistWA(
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

    function isWhitelisted(
        address addr
        )
        public
        view
        returns (bool) {
        return wallet.isAddressWhitelisted(addr);
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
        returns (bytes32 approvedHash)
    {
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.callContractWA(
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.approveTokenWA(
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
        returns (bytes32 approvedHash)
    {
        approvedHash = wallet.approveThenCallContractWA(
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
