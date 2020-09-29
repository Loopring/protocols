// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,uint32 index,uint96[] joinAmounts,uint96[] joinFees,bool joinFromLayer2,uint32 joinStorageID,uint96 mintMinAmount,bool mintToLayer2,uint256 validUntil)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    function joinPool(
        AmmData.State storage S,
        AmmData.Direction     direction,
        uint96[]     calldata joinAmounts,
        uint96[]     calldata joinFees,
        uint32                joinStorageID,
        uint96                mintMinAmount
        )
        public
    {
        uint size = S.tokens.length - 1;
        require(
            joinAmounts.length == size &&
            joinFees.length == size,
            "INVALID_PARAMS"
        );

        for (uint i = 0; i < size; i++) {
            require(joinFees[i] < joinAmounts[i], "INVALID_FEES");
        }

        // are locked this transaction can simply be dropped.
        uint validUntil = block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN();
        AmmData.User storage user = S.userMap[msg.sender];

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            index: uint32(user.lockRecords.length + 1),
            owner: msg.sender,
            direction:direction,
            joinAmounts: joinAmounts,
            joinFees: joinFees, // TODO: layer1 charge a fee?
            joinStorageID: joinStorageID,
            mintMinAmount: mintMinAmount,
            validUntil: validUntil
        });

        bytes32 txHash = hash(S.domainSeparator, join);
        S.approvedTx[txHash] = 0xffffffff;

        if (join.direction == AmmData.Direction.L1_TO_L1 ||
            join.direction == AmmData.Direction.L1_TO_L2) {

            for (uint i = 0; i < size; i++) {
                AmmUtil.transferIn(S.tokens[i + 1].addr, joinAmounts[i]);
            }


            user.lockRecords.push(
                AmmData.LockRecord({
                    index: uint32(user.lockRecords.length + 1),
                    txHash:txHash,
                    amounts: joinAmounts,
                    validUntil: validUntil
                })
            );
        }

        emit PoolJoinRequested(join);
    }

    function hash(
        bytes32                 domainSeparator,
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
                    join.index,
                    join.owner,
                    join.direction,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinFees)),
                    join.joinStorageID,
                    join.mintMinAmount,
                    join.validUntil
                )
            )
        );
    }
}
