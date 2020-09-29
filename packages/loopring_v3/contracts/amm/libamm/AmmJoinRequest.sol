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
        "PoolJoin(address owner,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint256 validUntil,uint256[] fees)"
    );

    event PoolJoinRequested(AmmData.PoolJoin join);

    // Submit a layer-1 join request
    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        uint96[]     calldata fees
        )
        public
    {
        uint size = S.tokens.length;
        require(maxAmountsIn.length == size - 1, "INVALID_DATA");
        require(fees.length == size - 1, "INVALID_DATA");

        for (uint i = 0; i < size - 1; i++) {
            require(maxAmountsIn[i] > fees[i], "INVALID_JOIN_AMOUNT");
        }

        // are locked this transaction can simply be dropped.
        uint validUntil = block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN();

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            validUntil: validUntil,
            fees: fees
        });

        bytes32 txHash = hashPoolJoin(S.domainSeparator, join);
        // Approve the join
        S.approvedTx[txHash] = 0xffffffff;

        AmmData.User storage user = S.userMap[msg.sender];
        user.lockRecords.push(
            AmmData.LockRecord({
                txHash:txHash,
                amounts: maxAmountsIn,
                validUntil: validUntil
            })
        );

        // Deposit AMM tokens
        for (uint i = 1; i < size; i++) {
            AmmUtil.transferIn(S.tokens[i].addr, maxAmountsIn[i - 1]);
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
                    join.minPoolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn)),
                    join.validUntil,
                    keccak256(abi.encodePacked(join.fees))
                )
            )
        );
    }
}
