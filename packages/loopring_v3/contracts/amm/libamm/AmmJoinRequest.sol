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
import "./AmmUtil.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    function deposit(
        AmmData.State storage S,
        uint                  poolAmount,
        uint96[]     calldata amounts
        )
        public
    {
        uint size = S.tokens.length;
        require(amounts.length == size, "INVALID_DATA");

        if (S.isExiting[msg.sender]) {
            // Q: 这个标记的用途？
            // This could suddenly change the amount of liquidity tokens available, which
            // could change how the operator needs to process the exit.
            require(poolAmount == 0, "CANNOT_DEPOSIT_LIQUIDITY_TOKENS_WHILE_EXITING");
        }

        if (poolAmount > 0) {
            address poolToken = address(this);
            depositAndLockToken(S, poolToken, poolAmount);
        }

        for (uint i = 0; i < size; i++) {
            depositAndLockToken(S, S.tokens[i].addr, uint(amounts[i]));
        }
    }

    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        bool                  fromLayer2,
        uint                  validUntil
        )
        public
        returns(AmmData.PoolJoin memory join)
    {
        require(maxAmountsIn.length == S.tokens.length, "INVALID_DATA");

        // Don't check the available funds here, if the operator isn't sure the funds
        // are locked this transaction can simply be dropped.

        join = AmmData.PoolJoin({
            owner: msg.sender,
            fromLayer2: fromLayer2,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            storageIDs: new uint32[](0),
            validUntil: validUntil
        });

        // Approve the join
        bytes32 txHash = AmmUtil.hashPoolJoin(S.domainSeperator, join);
        S.approvedTx[txHash] = 0xffffffff;
    }

    function depositAndLockToken(
        AmmData.State storage S,
        address               token,
        uint                  amount
        )
        private
    {
        if (token == address(0)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
        } else {
            token.safeTransferFromAndVerify(msg.sender, address(this), amount);
        }

        S.lockedBalance[token][msg.sender] = S.lockedBalance[token][msg.sender].add(amount);
        S.totalLockedBalance[token] = S.totalLockedBalance[token].add(amount);
    }
}
