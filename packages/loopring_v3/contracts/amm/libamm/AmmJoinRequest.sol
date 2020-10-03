// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "./AmmData.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,uint96[] joinAmounts,uint96[] joinFees,uint32[] joinStorageIDs,uint96 mintMinAmount,uint32 validUntil)"
    );

    function hash(
        bytes32 domainSeparator,
        AmmData.PoolJoin memory join
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLJOIN_TYPEHASH,
                    join.owner,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinFees)),
                    keccak256(abi.encodePacked(join.joinStorageIDs)),
                    join.mintMinAmount,
                    join.validUntil
                )
            )
        );
    }
}
