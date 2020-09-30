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

// TODO:fix this string
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
            "INVALID_PARAM_SIZE"
        );

        for (uint i = 0; i < size; i++) {
            // require(joinFees[i] < joinAmounts[i], "INVALID_FEES");
            require(joinAmounts[i] > 0, "INVALID_VALUE");
            require(joinFees[i] == 0, "FEATURE_DISABLED");
        }

        bool fromLayer1 = (
            direction == AmmData.Direction.L1_TO_L1 ||
            direction == AmmData.Direction.L1_TO_L2
        );

        if (fromLayer1) {
            require(joinStorageID == 0, "INVALID_STORAGE_ID");

            for (uint i = 0; i < size; i++) {
                AmmUtil.transferIn(S.tokens[i].addr, joinAmounts[i]);
            }
        }

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            direction:direction,
            joinAmounts: joinAmounts,
            joinFees: joinFees,
            joinStorageID: joinStorageID,
            mintMinAmount: mintMinAmount,
            validUntil: block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN(),
            nonce: uint32(S.joinQueue[msg.sender].length + 1)
        });

        bytes32 txHash = hash(S.domainSeparator, join);
        S.approvedTx[txHash] = join.validUntil;

        if (fromLayer1) {
            AmmData.TokenLock memory record = AmmData.TokenLock({
                // txHash:txHash,
                amounts: joinAmounts
            });
            S.joinQueue[msg.sender].push(record);
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
                    join.owner,
                    join.direction,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinFees)),
                    join.joinStorageID,
                    join.mintMinAmount,
                    join.validUntil,
                    join.nonce
                )
            )
        );
    }
}
