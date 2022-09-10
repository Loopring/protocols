// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./LoopringWalletAgent.sol";


/// @title DestroyableWalletAgent
/// @dev Agent that allows setting up accounts that can easily be rendered unusable
/// @author Brecht Devos - <brecht@loopring.org>
contract DestroyableWalletAgent is LoopringWalletAgent
{
    struct WalletData
    {
        uint32 accountID;
        bool destroyed;
    }
    mapping(address => WalletData) public walletData;

    constructor(
        address     _walletImplementation,
        address     _deployer,
        IExchangeV3 exchange
        )
        LoopringWalletAgent(_walletImplementation, _deployer, exchange)
    {}

    function beforeBlockSubmission(
        bytes calldata txsData,
        bytes calldata callbackData
        )
        external
        override
    {
        AccountUpdateTransaction.AccountUpdate memory accountUpdate;
        accountUpdate = LoopringWalletAgent._beforeBlockSubmission(txsData, callbackData);

        WalletData storage wallet = walletData[accountUpdate.owner];
        if (wallet.accountID == 0) {
            // First use of this wallet, store the accountID
            wallet.accountID = accountUpdate.accountID;
        } else {
            // Only allow a single account on L2 to ever sign L2 transactions
            // for this wallet address
            require(
                wallet.accountID == accountUpdate.accountID,
                "ACCOUNT_ALREADY_EXISTS_FOR_WALLET"
            );
        }
        // Destroy the wallet if the EdDSA public key is set to 0
        if (accountUpdate.publicKey == 0) {
            wallet.destroyed = true;
        }
    }

    /// @dev Computes the destructable wallet address
    /// @param owner The owner.
    /// @param salt A salt.
    /// @return The wallet address
    function computeWalletAddress(
        address owner,
        uint    salt
        )
        public
        view
        returns (address)
    {
        return _computeWalletAddress(
            owner,
            salt,
            deployer
        );
    }

    /// @dev Checks if the wallet can still be used
    /// @param wallet The wallet address.
    /// @return Returns true if destroyed, else false
    function isDestroyed(
        address wallet
        )
        public
        view
        returns (bool)
    {
        return walletData[wallet].destroyed;
    }

    // Disable `approveTransactionsFor`
    function approveTransactionsFor(
        address[] calldata /*wallets*/,
        bytes32[] calldata /*txHashes*/,
        bytes[]   calldata /*signatures*/
        )
        external
        override
        pure
    {
        revert("UNSUPPORTED");
    }

    // == Internal Functions ==

    function _isInitialOwnerUsable(
        address wallet
        )
        internal
        view
        override
        returns (bool)
    {
        // Also disallow the owner to use the wallet when destroyed
        return LoopringWalletAgent._isInitialOwnerUsable(wallet) &&
               !isDestroyed(wallet);
    }
}
