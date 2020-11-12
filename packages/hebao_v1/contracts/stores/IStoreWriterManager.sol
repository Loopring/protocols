// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IStoreWriterManager
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IStoreWriterManager
{
   function isStoreWriter(address addr) external view returns (bool);
}
