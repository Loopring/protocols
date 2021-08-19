// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../thirdparty/loopring-wallet/ILoopringWalletV2.sol";


struct Wallet
{
    address owner;
    uint64  creationTimestamp;
}

/// @title Test SmartWallet
/// @dev Test smart wallet contract
/// @author Brecht Devos - <brecht@loopring.org>
contract TestLoopringWalletV2 is ILoopringWalletV2
{
    // WARNING: Do not delete wallet state data to make this implementation
    // compatible with early versions.
    //
    //  ----- DATA LAYOUT BEGINS -----
    // Always needs to be first
    address internal masterCopy;

    Wallet public wallet;
    //  ----- DATA LAYOUT ENDS -----

    function initialize(
        address             owner,
        address[] calldata  /*guardians*/,
        uint                /*quota*/,
        address             /*inheritor*/,
        address             /*feeRecipient*/,
        address             /*feeToken*/,
        uint                /*feeAmount*/
        )
        external
        override
    {
        wallet.owner = owner;
        wallet.creationTimestamp = uint64(block.timestamp);
    }

    function getCreationTimestamp()
        public
        view
        override
        returns (uint64)
    {
        return wallet.creationTimestamp;
    }

    function getOwner()
        public
        view
        override
        returns (address)
    {
        return wallet.owner;
    }

    receive()
        external
        payable
    {
    }
}
