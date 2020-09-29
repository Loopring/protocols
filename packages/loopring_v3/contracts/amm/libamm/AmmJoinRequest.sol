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
        "PoolJoin(address owner,uint96[] joinAmounts,uint96[] joinFees,bool joinFromLayer2,uint32 joinStorageID,uint256 mintMinAmount,bool mintToLayer2,uint256 validUntil)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    function joinPool(
        AmmData.State storage S,
        uint96[]     calldata joinAmounts,
        uint96[]     calldata joinFees,
        bool                  joinFromLayer2,
        uint32                joinStorageID,
        uint                  mintMinAmount,
        bool                  mintToLayer2
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

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            joinAmounts: joinAmounts,
            joinFees: joinFees, // TODO: layer1 charge a fee?
            joinFromLayer2: joinFromLayer2,
            joinStorageID: joinStorageID,
            mintMinAmount: mintMinAmount,
            mintToLayer2: mintToLayer2,
            validUntil: validUntil
        });

        bytes32 txHash = hashPoolJoin(S.domainSeparator, join);
        S.approvedTx[txHash] = 0xffffffff;

        if (!join.joinFromLayer2) {
            for (uint i = 0; i < size; i++) {
                AmmUtil.transferIn(S.tokens[i + 1].addr, joinAmounts[i]);
            }

            AmmData.User storage user = S.userMap[msg.sender];
            user.lockRecords.push(
                AmmData.LockRecord({
                    txHash:txHash,
                    amounts: joinAmounts,
                    validUntil: validUntil
                })
            );
        }

        emit PoolJoinRequested(join);
    }

    function hashPoolJoin(
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
                    join.owner,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinFees)),
                    join.joinFromLayer2,
                    join.joinStorageID,
                    join.mintMinAmount,
                    join.mintToLayer2,
                    join.validUntil
                )
            )
        );
    }
}
