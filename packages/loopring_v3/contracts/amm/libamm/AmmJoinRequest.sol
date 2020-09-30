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
        "PoolJoin(address owner,bool joinFromLayer2,uint96[] joinAmounts,uint96[] joinFees,uint32[] joinStorageIDs,bool mintToLayer2,uint96 mintMinAmount,uint256 validUntil,uint32 nonce)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    function joinPool(
        AmmData.State storage S,
        bool                  joinFromLayer2,
        uint96[]     calldata joinAmounts,
        uint96[]     calldata joinFees,
        uint32[]     calldata joinStorageIDs,
        bool                  mintToLayer2,
        uint96                mintMinAmount
        )
        public
    {
        uint size = S.tokens.length - 1;
        require(
            joinAmounts.length == size &&
            joinFees.length == size &&
            joinStorageIDs.length == size,
            "INVALID_PARAM_SIZE"
        );

        for (uint i = 0; i < size; i++) {
            require(joinAmounts[i] > 0, "INVALID_VALUE");
            require(joinFees[i] < joinAmounts[i], "INVALID_FEES");

            // TODO(daniel): Enable fees
            require(joinFees[i] == 0, "FEATURE_DISABLED_FOR_NOW");
        }

        uint32 nonce = 0;
        if (joinFromLayer2) {
            require(joinStorageIDs.length == size, "INVALID_STORAGE_IDS");
        } else {
            require(joinStorageIDs.length == 0, "INVALID_STORAGE_IDS");

            nonce = uint32(S.joinLocks[msg.sender].length + 1);

            for (uint i = 0; i < size; i++) {
                AmmUtil.transferIn(S.tokens[i].addr, joinAmounts[i]);
            }
        }

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            joinFromLayer2:joinFromLayer2,
            joinAmounts: joinAmounts,
            joinFees: joinFees,
            joinStorageIDs: joinStorageIDs,
            mintToLayer2: mintToLayer2,
            mintMinAmount: mintMinAmount,
            validUntil: block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN(),
            nonce: nonce
        });

        // Approve the join
        bytes32 txHash = hash(S.domainSeparator, join);
        S.approvedTx[txHash] = join.validUntil;

        if (!joinFromLayer2) {
            S.joinLocks[msg.sender].push(AmmData.TokenLock({
                amounts: joinAmounts
            }));
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
                    join.joinFromLayer2,
                    keccak256(abi.encodePacked(join.joinAmounts)),
                    keccak256(abi.encodePacked(join.joinFees)),
                    keccak256(abi.encodePacked(join.joinStorageIDs)),
                    join.mintToLayer2,
                    join.mintMinAmount,
                    join.validUntil,
                    join.nonce
                )
            )
        );
    }
}
