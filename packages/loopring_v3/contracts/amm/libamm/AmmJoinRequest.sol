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
        "PoolJoin(address owner,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint256[] fees,uint256 validUntil)"
    );

    event Deposit(address owner, uint96[] amounts);
    event PoolJoinRequested(AmmData.PoolJoin join);

    function depositToPool(
        AmmData.State storage S,
        uint96[]     calldata amounts
        )
        public
    {
        uint size = S.tokens.length;
        require(amounts.length == size + 1, "INVALID_DATA");

        if (S.isExiting[msg.sender]) {
            // This could suddenly change the amount of liquidity tokens available, which
            // could change how the operator needs to process the exit.
            require(amounts[0] == 0, "CANNOT_DEPOSIT_LIQUIDITY_TOKENS_WHILE_EXITING");
        }

        // Deposit pool tokens
        AmmUtil.transferIn(address(this), amounts[0]);

        // Deposit AMM tokens
        for (uint i = 0; i < size; i++) {
            AmmUtil.transferIn(S.tokens[i].addr, amounts[i + 1]);
        }

        emit Deposit(msg.sender, amounts);
    }


    // Submit a layer-1 join request
    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        uint96[]     calldata fees
        )
        public
    {
        uint size =  S.tokens.length;
        require(maxAmountsIn.length == size, "INVALID_DATA");

        for (uint i = 0; i < size; i++) {
            require(maxAmountsIn[i] > fees[i], "INVALID_JOIN_AMOUNT");
        }

        // Don't check the available funds here, if the operator isn't sure the funds

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

        AmmData.User storage user = S.UserMap[msg.sender];
        user.lockRecords.push(
            AmmData.LockRecord({
                hash:txHash,
                amounts: maxAmountsIn,
                validUntil: validUntil
            })
        );

        // Deposit AMM tokens
        for (uint i = 0; i < size; i++) {
            AmmUtil.transferIn(S.tokens[i].addr, maxAmountsIn[i]);
        }

        emit PoolJoinRequested(join);
    }

    function withdraw(AmmData.State storage S)
        public
    {
        (uint[] memory amounts, uint newStartIndex) = getWithdrawables(S);
        AmmData.User storage user = S.UserMap[msg.sender];

        // Clear pool token withdrawable

        delete user.withdrawable[address(this)];
        AmmUtil.transferOut(address(this), amounts[0], msg.sender);

        // Clear each token's withdrawable
        for (uint i = 0; i < S.tokens.length; i++) {
            delete user.withdrawable[S.tokens[i].addr];
            AmmUtil.transferOut(S.tokens[i].addr, amounts[i + 1], msg.sender);
        }

        // Delete expired joins
        for (uint i = user.startIndex; i < newStartIndex; i++) {
            delete S.approvedTx[user.lockRecords[i].hash];
            delete user.lockRecords[i];
        }

        user.startIndex = newStartIndex;

        // TODO: Transfer tokens back to the user
    }

    function getWithdrawables(AmmData.State storage S)
        internal
        view
        returns (
            uint[] memory amounts,
            uint   newStartIndex
        )
    {
        uint size = S.tokens.length;
        amounts = new uint[](size);

        AmmData.User storage user = S.UserMap[msg.sender];

        amounts[0] = user.withdrawable[address(this)];

        for (uint i = 0; i < size; i++) {
            amounts[i] = user.withdrawable[S.tokens[i].addr];
        }

        uint idx = user.startIndex;
        while(idx < user.lockRecords.length) {
            AmmData.LockRecord storage record = user.lockRecords[idx];
            if (record.validUntil > block.timestamp) {
                return (amounts, idx);
            }

            if (S.approvedTx[record.hash] > 0) {
                for (uint i = 0; i < size; i++) {
                    amounts[i + 1] = amounts[i].add(record.amounts[i]);
                }
            }
        }
        return (amounts, idx);
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
                    keccak256(abi.encodePacked(join.fees)),
                    join.validUntil
                )
            )
        );
    }
}
