// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IStoreAccessManager
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IStoreAccessManager
{
   function isAccessAllowed(address addr) external view returns (bool);
}
