// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../access/ITransactionReceiver.sol";

/// @title  IBatchDepositor interface
/// @author Brecht Devos - <brecht@loopring.org>
interface IBatchDepositor
{
    struct Deposit
    {
        address owner;
        address token;
        uint96  amount;
    }
    /// @dev Optimized L1 -> L2 path. Allows doing many deposits in an efficient way.
    ///
    ///      Every normal deposit to Loopring exchange does a real L1 token transfer
    ///      and stores some data on-chain costing ~65k gas.
    ///      This function batches all deposits togeter and only does a single exchange
    ///      deposit for each distinct token. All deposits are then handled by L2 transfers
    ///      instead of L1 transfers, which makes them much cheaper.
    ///
    ///      The sender will send the funds to Loopring exchange, so just like with normal
    ///      deposits the sender first has to approve token transfers on the deposit contract.
    ///
    /// @param deposits The L2 deposits from Bridge to owners
    function batchDeposit(Deposit[] calldata deposits)
        external
        payable;
}
