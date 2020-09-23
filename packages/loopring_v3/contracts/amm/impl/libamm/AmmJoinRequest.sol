// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../AmmData.sol";
import "../../../lib/EIP712.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/MathUint96.sol";
import "../../../thirdparty/SafeCast.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,bool fromLayer2,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint32[] storageIDs,uint256 validUntil)"
    );

    event Deposit(
        address  owner,
        uint     poolAmount,
        uint96[] amounts
    );

    event JoinPoolRequested(
        address  owner,
        bool     fromLayer2,
        uint     minPoolAmountOut,
        uint96[] maxAmountsIn,
        uint     validUntil
    );

    function deposit(
        AmmData.State storage S,
        uint                  poolAmount,
        uint96[]     calldata amounts
        )
        external
    {
        require(amounts.length == S.tokens.length, "INVALID_DATA");
        if (S.isExiting[msg.sender]) {
            // Q: 这个标记的用途？
            // This could suddenly change the amount of liquidity tokens available, which
            // could change how the operator needs to process the exit.
            require(poolAmount == 0, "CANNOT_DEPOSIT_LIQUIDITY_TOKENS_WHILE_EXITING");
        }

        // Lock up funds inside this contract so we can depend on them being available.
        for (uint i = 0; i < S.tokens.length + 1; i++) {
            uint amount = (i < S.tokens.length) ? amounts[i] : poolAmount;
            address token = (i < S.tokens.length) ? S.tokens[i].addr : address(this);
            if (token == address(0)) {
                require(msg.value == amount, "INVALID_ETH_DEPOSIT");
            } else {
                token.safeTransferFromAndVerify(msg.sender, address(this), uint(amount));
            }
            S.lockedBalance[token][msg.sender] = S.lockedBalance[token][msg.sender].add(amount);
            S.totalLockedBalance[token] = S.totalLockedBalance[token].add(amount);
        }

        emit Deposit(msg.sender, poolAmount, amounts);
    }

    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        bool                  fromLayer2,
        uint                  validUntil
        )
        internal
    {
        require(maxAmountsIn.length == S.tokens.length, "INVALID_DATA");

        // Don't check the available funds here, if the operator isn't sure the funds
        // are locked this transaction can simply be dropped.

        // Approve the join
        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            fromLayer2: fromLayer2,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            storageIDs: new uint32[](0), // Q：这是做什么的？
            validUntil: validUntil
        });
        bytes32 txHash = hashPoolJoin(S.DOMAIN_SEPARATOR, join);
        S.approvedTx[txHash] = 0xffffffff;

        emit JoinPoolRequested(
            msg.sender,
            fromLayer2,
            minPoolAmountOut,
            maxAmountsIn,
            validUntil
        );
    }

    function hashPoolJoin(
        bytes32 _DOMAIN_SEPARATOR,
        AmmData.PoolJoin memory join
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            _DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    POOLJOIN_TYPEHASH,
                    join.owner,
                    join.fromLayer2,
                    join.minPoolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn)),
                    keccak256(abi.encodePacked(join.storageIDs)),
                    join.validUntil
                )
            )
        );
    }
}
