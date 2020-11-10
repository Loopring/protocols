// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

/// @title Wallet
/// @dev Base contract for smart wallets.
///      Sub-contracts must NOT use non-default constructor to initialize
///      wallet states, instead, `init` shall be used. This is to enable
///      proxies to be deployed in front of the real wallet contract for
///      saving gas.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IWallet
{
    function versionRegistry() external view returns (address);
    function versionLabel() external view returns (string memory);
    function versionNumber() external view returns (uint);

    function version() external view returns (address);
    function setVersion(address newVersion) external;

    function owner() external view returns (address);
    function setOwner(address newOwner) external;

    /// @dev Performs generic transactions. Any module that has been added to this
    ///      wallet can use this method to transact on any third-party contract with
    ///      msg.sender as this wallet itself.
    ///
    ///      This method will emit `Transacted` event if it doesn't throw.
    ///
    ///      Note: this method must ONLY allow invocations from a module that has
    ///      been added to this wallet. The wallet owner shall NOT be permitted
    ///      to call this method directly.
    ///
    /// @param mode The transaction mode, 1 for CALL, 2 for DELEGATECALL.
    /// @param to The desitination address.
    /// @param value The amount of Ether to transfer.
    /// @param data The data to send over using `to.call{value: value}(data)`
    /// @return returnData The transaction's return value.
    function transact(
        uint8    mode,
        address  to,
        uint     value,
        bytes    calldata data
        )
        external
        returns (bytes memory returnData);
}
