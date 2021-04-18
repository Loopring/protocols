// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

struct BridgeCall
{
    address owner;
    address token;
    uint96  amount;
    bytes   userData;
    uint    minGas;
    uint    maxFee;
    uint    validUntil;
}

struct ConnectorGroup
{
    bytes        groupData;
    BridgeCall[] calls;
}

struct L2Transfer
{
    address to;  // the owner of the transfer recipient account
    address token;
    uint96  amount;
}

/// @title  IBridge interface
/// @author Brecht Devos - <brecht@loopring.org>
interface IBridge
{
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
    /// @param deposits The deposits
    function batchDeposit(L2Transfer[] calldata deposits)
        external
        payable;
}

/// @title  IBridgeConnector interface
/// @author Brecht Devos - <brecht@loopring.org>
interface IBridgeConnector
{
    /// @dev Optimized L2 -> L1 (-> L2) path. Allows interacting with L1 dApps in an efficient way.
    ///
    ///     For a user to interact with L1 the user normally needs to first withdraw and then
    ///     do a normal L1 transaction. And if the user then also wants to move back to L2 a deposit
    ///     is necessary again. With high gas prices this can get expensive.
    ///
    ///     The bridge allows batching expensive L1 work between users:
    ///     - All withdrawals are reduced to just a single withdrawal per distinct token for all bridge operations
    ///     - The L1 transaction itself (if the operation allows for this) can be shared between all users
    ///       that want to do the same operation.
    ///     - All deposits back to L2 are also reduced to just a single deposit per distinct token for all bridge operations
    ///
    ///     Most of this is abstracted away in the bridge. A user sings a BridgeCall and `processCalls`
    ///     gets a list of bridge calls divided in lists based on `groupData`
    ///     (e.g. for a uniswap connector the group would be the 2 tokens being traded).
    ///     Each bridge call contains how much each user transfered to the bridge to be used for the specific bridge call.
    ///     The bridge call also contain a user specific `userData` which can contain per user parameters (e.g. for
    ///     uniswap the allowd slippage, for mass migration the destination address,...).
    ///     In some cases the interaction results in new tokens that the user wants to receive back on L2. To allow this
    ///     the function returns a list of transfers that need to be done from the bridge back to the users (which would
    ///     be similar to just calling IBridge.batchDeposit(), but by returning the list here more optimizations are possible
    ///     between different connector calls).
    ///
    /// @param groups The groups of bridge calls to process
    function processCalls(ConnectorGroup[] calldata groups)
        external
        payable
        returns (L2Transfer[] memory);

    /// @dev Returns a rough estimate of the gas cost to do `processCalls`. At least this much gas needs to be
    ///      provided by the caller of `processCalls` before the BridgeCalls of users are allowed to be used.
    ///
    ///      Aach bridge call only pays for a small part of the necessary total gas consumed by a
    ///      a connector call. As such, the caller of `processCalls` would easily be able to just let all
    ///      `processCalls` calls fail by e.g. not batching enough Bridge calls together (while still collecting the fee).
    ///
    /// @param groups The groups of bridge calls to process
    function getMinGasLimit(ConnectorGroup[] calldata groups)
        external
        pure
        returns (uint);
}