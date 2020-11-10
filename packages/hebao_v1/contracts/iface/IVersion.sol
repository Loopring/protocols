// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IVersion
/// @dev Base contract for wallet Versions.
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IVersion
{
    function migrateFrom(address oldVersion) external;

    function isAuthorized(address sender, bytes4 method) external view returns (bool);

    function getBinding(bytes4 method) external view returns (address);
}
