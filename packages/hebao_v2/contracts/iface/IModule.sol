// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IModule
/// @author Daniel Wang - <daniel@loopring.org>
interface IModule
{
    function bindableMethods() external pure returns (bytes4[] memory);
}
