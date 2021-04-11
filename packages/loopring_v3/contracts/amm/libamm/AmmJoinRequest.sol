// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "./AmmData.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    bytes32 constant private POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,uint96[] joinAmounts,uint32[] joinStorageIDs,uint96 mintMinAmount,uint96 fee,uint32 validUntil)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    function joinPool(
        AmmData.State storage S,
        uint96[]     calldata joinAmounts,
        uint96                mintMinAmount,
        uint96                fee
        )
        public
    {
        require(joinAmounts.length == S.tokens.length,"INVALID_PARAM_SIZE");

        for (uint i = 0; i < S.tokens.length; i++) {
            require(joinAmounts[i] > 0, "INVALID_VALUE");
        }

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            joinAmounts: joinAmounts,
            joinStorageIDs: new uint32[](0),
            mintMinAmount: mintMinAmount,
            fee: fee,
            validUntil: uint32(block.timestamp + S.sharedConfig.maxForcedExitAge())
        });

        // Approve the join
        bytes32 txHash = hash(S.domainSeparator, join);
        S.approvedTx[txHash] = true;

        emit PoolJoinRequested(join);
    }

    function hash(
        bytes32 domainSeparator,
        AmmData.PoolJoin memory join
        )
        internal
        pure
        returns (bytes32 h)
    {
        /*return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLJOIN_TYPEHASH,
                    join.owner,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinStorageIDs)),
                    join.mintMinAmount,
                    join.fee,
                    join.validUntil
                )
            )
        );*/
        bytes32 typeHash = POOLJOIN_TYPEHASH;
        address owner = join.owner;
        uint96[] memory joinAmounts = join.joinAmounts;
        uint32[] memory storageIDs = join.joinStorageIDs;
        uint mintMinAmount = join.mintMinAmount;
        uint fee = join.fee;
        uint validUntil = join.validUntil;
        assembly {
            let data := mload(0x40)
            mstore(    data      , typeHash)
            mstore(add(data,  32), owner)
            mstore(add(data,  64), keccak256(add(joinAmounts, 32), mul(mload(joinAmounts), 32)))
            mstore(add(data,  96), keccak256(add(storageIDs, 32), mul(mload(storageIDs), 32)))
            mstore(add(data, 128), mintMinAmount)
            mstore(add(data, 160), fee)
            mstore(add(data, 192), validUntil)
            let p := keccak256(data, 224)
            mstore(data, "\x19\x01")
            mstore(add(data,  2), domainSeparator)
            mstore(add(data, 34), p)
            h := keccak256(data, 66)
        }
    }
}
