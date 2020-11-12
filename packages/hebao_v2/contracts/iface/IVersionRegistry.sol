// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IVersionRegistry
///
/// @author Daniel Wang - <daniel@loopring.org>
interface IVersionRegistry
{
    /// @dev Returns a version's numeric number. For invalid version addres,
    ///      0 will be returned.
   function getVersionNumber(address version) external view returns (uint);
}
