// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface AmmSharedConfig
{
    function maxForcedExitAge() external pure returns (uint);
    function maxForcedExitCount() external pure returns (uint);
}