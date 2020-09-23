// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


/// @title LPToken
library AmmJoin
{
    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,bool fromLayer2,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint32[] storageIDs,uint256 validUntil)"
    );
}
