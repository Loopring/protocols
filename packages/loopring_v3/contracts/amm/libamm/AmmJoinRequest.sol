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
        "PoolJoin(address owner,bool fromLayer2,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint256[] fees,uint32[] storageIDs,uint256 validUntil)"
    );

    event Deposit(address owner, uint96[] amounts);
    event PoolJoinRequested(AmmData.PoolJoin join);
    event LockScheduled(address owner, uint timestamp);

    function lock(
        AmmData.State storage S
        )
        public
        returns (uint lockedSince)
    {
        require(S.lockedSince[msg.sender] == 0, "LOCKED_ALREADY");
        require(
            S.lockedUntil[msg.sender] != 0 &&
            S.lockedUntil[msg.sender] >= block.timestamp,
            "UNLOCK_PENDING"
        );

        lockedSince = block.timestamp + AmmData.LOCK_DELAY();

        S.lockedSince[msg.sender] = lockedSince;
        S.lockedUntil[msg.sender] = 0;

        emit LockScheduled(msg.sender, lockedSince);
    }

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
        _depositToken(S, address(this), amounts[0]);

        // Deposit AMM tokens
        for (uint i = 0; i < size; i++) {
            _depositToken(S, S.tokens[i].addr, amounts[i + 1]);
        }

        emit Deposit(msg.sender, amounts);
    }

    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        uint96[]     calldata fees,
        bool                  fromLayer2,
        uint                  validUntil
        )
        public
    {
        uint size =  S.tokens.length;
        require(maxAmountsIn.length == size, "INVALID_DATA");

        require(
            validUntil > block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN(),
            "VALID_UNTIL_TOO_SMALL"
        );

        for (uint i = 0; i < size; i++) {
            require(maxAmountsIn[i] > fees[i], "INVALID_JOIN_AMOUNT");
        }

        // Don't check the available funds here, if the operator isn't sure the funds
        // are locked this transaction can simply be dropped.

        AmmData.PoolJoin memory join = AmmData.PoolJoin({
            owner: msg.sender,
            fromLayer2: fromLayer2,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            fees: fees,
            storageIDs: new uint32[](0),
            validUntil: validUntil
        });

        // Approve the join
        bytes32 txHash = hashPoolJoin(S.domainSeparator, join);
        S.approvedTx[txHash] = 0xffffffff;

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
                    join.fromLayer2,
                    join.minPoolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn)),
                    keccak256(abi.encodePacked(join.fees)),
                    keccak256(abi.encodePacked(join.storageIDs)),
                    join.validUntil
                )
            )
        );
    }

    function _depositToken(
        AmmData.State storage S,
        address               token,
        uint                  amount
        )
        private
    {
        if (token == address(0)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
        } else if (amount > 0) {
            token.safeTransferFromAndVerify(msg.sender, address(this), amount);
        }

        if (amount > 0) {
            S.addUserBalance(token, msg.sender, amount);
        }
    }
}
