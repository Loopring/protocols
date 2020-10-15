// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface IAmmSharedConfig
{
    function maxForcedExitAge() external view returns (uint);
    function maxForcedExitCount() external view returns (uint);
    function forcedExitFee() external view returns (uint);
}