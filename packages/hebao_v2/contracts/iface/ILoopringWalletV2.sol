// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;


/// @title Loopring SmartWallet V2 interface
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract ILoopringWalletV2
{
    /// @dev Initializes the smart wallet.
    /// @param owner The wallet owner address.
    /// @param guardians The initial wallet guardians.
    /// @param quota The initial wallet quota.
    /// @param inheritor The inheritor of the wallet.
    /// @param feeRecipient The address receiving the fee for creating the wallet.
    /// @param feeToken The token to use for the fee payment.
    /// @param feeAmount The amount of tokens paid to the fee recipient.
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
        virtual;

    /// @dev Returns the timestamp the wallet was created.
    /// @return The timestamp the wallet was created.
    function getCreationTimestamp()
        public
        view
        virtual
        returns (uint64);

    /// @dev Returns the current wallet owner.
    /// @return The current wallet owner.
    function getOwner()
        public
        view
        virtual
        returns (address);
}
