// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../thirdparty/loopring-wallet/ILoopringWalletV2.sol";
import "../../thirdparty/loopring-wallet/WalletDeploymentLib.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/SignatureUtil.sol";
import "../../aux/access/IBlockReceiver.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../core/impl/libtransactions/AccountUpdateTransaction.sol";


/// @title LoopringWalletAgent
/// @dev Agent to allow authorizing L2 transactions using an undeployed Loopring Smart Wallet
/// @author Brecht Devos - <brecht@loopring.org>
contract LoopringWalletAgent is WalletDeploymentLib, IBlockReceiver
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

    // Maximum amount of time this agent can still authorize transactions
    // approved by the initial wallet owner after the wallet has been deployed.
    uint     public constant  MAX_TIME_VALID_AFTER_CREATION = 7 days;

    address     public immutable deployer;
    IExchangeV3 public immutable exchange;
    bytes32     public immutable EXCHANGE_DOMAIN_SEPARATOR;

    struct WalletSignatureData
    {
        bytes    signature;
        uint96   maxFee;
        uint32   validUntil;

        address  walletOwner;
        uint     salt;
    }

    constructor(
        address        _walletImplementation,
        address        _deployer,
        IExchangeV3    _exchange
        )
        WalletDeploymentLib(_walletImplementation)
    {
        deployer = _deployer;
        exchange = _exchange;
        EXCHANGE_DOMAIN_SEPARATOR = _exchange.getDomainSeparator();
    }

    // Allows authorizing transactions in an independent transaction
    function approveTransactionsFor(
        address[] calldata wallets,
        bytes32[] calldata txHashes,
        bytes[]   calldata signatures
        )
        external
        virtual
    {
        require(txHashes.length == wallets.length, "INVALID_DATA");
        require(signatures.length == wallets.length, "INVALID_DATA");

        // Verify the signatures
        for (uint i = 0; i < wallets.length; i++) {
            WalletSignatureData memory data = abi.decode(signatures[i], (WalletSignatureData));
            require(
                _canInitialOwnerAuthorizeTransactions(wallets[i], msg.sender, data.salt) ||
                _isUsableSignatureForWallet(
                    wallets[i],
                    txHashes[i],
                    data
                ),
                "INVALID_SIGNATURE"
            );
        }

        // Approve the transactions on the exchange
        exchange.approveTransactions(wallets, txHashes);
    }

    // Allow transactions to be authorized while submitting a block
    function beforeBlockSubmission(
        bytes calldata txsData,
        bytes calldata callbackData
        )
        external
        override
        virtual
    {
        _beforeBlockSubmission(txsData, callbackData);
    }

    // Returns true if the signature can be used for authorizing the transaction
    function isUsableSignatureForWallet(
        address                    wallet,
        bytes32                    hash,
        bytes               memory signature
        )
        public
        view
        returns (bool)
    {
        WalletSignatureData memory data = abi.decode(signature, (WalletSignatureData));
        return _isUsableSignatureForWallet(wallet, hash, data);
    }

    // Returns true if just the signature is valid (but it may have expired)
    function isValidSignatureForWallet(
        address                    wallet,
        bytes32                    hash,
        bytes               memory signature
        )
        public
        view
        returns (bool)
    {
        WalletSignatureData memory data = abi.decode(signature, (WalletSignatureData));
        return _isValidSignatureForWallet(wallet, hash, data);
    }

    // Returns the timestamp up until the signature can be used
    function getSignatureExpiry(
        address                    wallet,
        bytes32                    hash,
        bytes               memory signature
        )
        public
        view
        returns (uint)
    {
        WalletSignatureData memory data = abi.decode(signature, (WalletSignatureData));
        if (!_isValidSignatureForWallet(wallet, hash, data)) {
            return 0;
        } else {
            return getInitialOwnerExpiry(wallet);
        }
    }

    // Returns the timestamp up until the initial owner can authorize transactions
    function getInitialOwnerExpiry(
        address walletAddress
        )
        public
        view
        returns (uint)
    {
        // Always allowed when the smart wallet hasn't been deployed yet
        if (!walletAddress.isContract()) {
            return type(uint).max;
        }

        ILoopringWalletV2 wallet = ILoopringWalletV2(walletAddress);

        // Allow the initial wallet owner to sign transactions after deployment for some limited time
        return wallet.getCreationTimestamp() + MAX_TIME_VALID_AFTER_CREATION;
    }

    // == Internal Functions ==

     function _beforeBlockSubmission(
        bytes calldata txsData,
        bytes calldata callbackData
        )
        internal
        view
        returns (AccountUpdateTransaction.AccountUpdate memory accountUpdate)
    {
        WalletSignatureData memory data = abi.decode(callbackData, (WalletSignatureData));

        // Read the AccountUpdate transaction
        AccountUpdateTransaction.readTx(txsData, 0, accountUpdate);

        // Fill in withdrawal data missing from DA
        accountUpdate.validUntil = data.validUntil;
        accountUpdate.maxFee = data.maxFee == 0 ? accountUpdate.fee : data.maxFee;
        // Validate
        require(block.timestamp < accountUpdate.validUntil, "ACCOUNT_UPDATE_EXPIRED");
        require(accountUpdate.fee <= accountUpdate.maxFee, "ACCOUNT_UPDATE_FEE_TOO_HIGH");

        // Calculate the transaction hash
        bytes32 txHash = AccountUpdateTransaction.hashTx(EXCHANGE_DOMAIN_SEPARATOR, accountUpdate);

        // Verify the signature
        require(
            _isUsableSignatureForWallet(
                accountUpdate.owner,
                txHash,
                data
            ),
            "INVALID_SIGNATURE"
        );

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ExchangeData.TX_DATA_AVAILABILITY_SIZE, "INVALID_NUM_TXS");
    }

    function _isUsableSignatureForWallet(
        address                    wallet,
        bytes32                    hash,
        WalletSignatureData memory data
        )
        internal
        view
        returns (bool)
    {
        // Verify that the signature is valid and the initial owner is still allowed
        // to authorize transactions for the wallet.
        return _isValidSignatureForWallet(wallet, hash, data) &&
               _isInitialOwnerUsable(wallet);
    }

    function _isValidSignatureForWallet(
        address                    wallet,
        bytes32                    hash,
        WalletSignatureData memory data
        )
        internal
        view
        returns (bool)
    {
        // Verify that the account owner is the initial owner of the smart wallet
        // and that the signature is a valid signature from the initial owner.
        return _isInitialOwner(wallet, data.walletOwner, data.salt) &&
               hash.verifySignature(data.walletOwner, data.signature);
    }

    function _canInitialOwnerAuthorizeTransactions(
        address wallet,
        address walletOwner,
        uint    salt
        )
        internal
        view
        returns (bool)
    {
        // Verify that the initial owner is the owner of the wallet
        // and can still be used to authorize transactions
        return _isInitialOwner(wallet, walletOwner, salt) &&
               _isInitialOwnerUsable(wallet);
    }

    function _isInitialOwnerUsable(
        address wallet
        )
        internal
        view
        virtual
        returns (bool)
    {
        return block.timestamp <= getInitialOwnerExpiry(wallet);
    }

    function _isInitialOwner(
        address wallet,
        address walletOwner,
        uint    salt
        )
        internal
        view
        returns (bool)
    {
        return _computeWalletAddress(walletOwner, salt, deployer) == wallet;
    }
}
