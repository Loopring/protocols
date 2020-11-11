// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IVersion
/// @dev Base contract for wallet Versions.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IVersion
{
    function label() external view returns (string memory);

    function migrateFrom(address oldVersion) external;

    function getBindingTarget(bytes4 method) external view returns (address);

    function feeRecipient() external view returns (address);
}
