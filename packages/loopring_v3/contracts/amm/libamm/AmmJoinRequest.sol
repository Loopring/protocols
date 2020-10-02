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
        "PoolJoin(address owner,uint96[] joinAmounts,uint96[] joinFees,uint32[] joinStorageIDs,uint96 mintMinAmount,uint256 validUntil)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    function joinPool(
        AmmData.State storage S,
        uint96[]     calldata joinAmounts,
        uint96[]     calldata joinFees,
        uint32[]     calldata joinStorageIDs,
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

        uint96[] memory totalAmounts = new uint96[](size);

        for (uint i = 0; i < size; i++) {
            require(joinAmounts[i] > 0, "INVALID_VALUE");
            require(joinFees[i] < joinAmounts[i], "INVALID_FEES");
            totalAmounts[i] = joinAmounts[i];
        }

        require(joinStorageIDs.length == size, "INVALID_STORAGE_IDS");

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            joinAmounts: joinAmounts,
            joinFees: joinFees,
            joinStorageIDs: joinStorageIDs,
            mintMinAmount: mintMinAmount,
            validUntil: block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN()
        });

        // Approve the join
        S.approvedTx[hash(S.domainSeparator, join)] = join.validUntil;
        emit PoolJoinRequested(join);
    }

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
