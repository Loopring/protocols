// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";


/// @title AmmExitRequest
library AmmExitRequest
{
    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,uint96 burnAmount,uint32 burnStorageID,uint96[] exitMinAmounts,uint32 validUntil)"
    );

    event ForcedPoolExitRequested(AmmData.PoolExit exit);

    function exitPool(
        AmmData.State storage S,
        uint96                burnAmount,
        uint96[]     calldata exitMinAmounts
        )
        public
    {
        require(burnAmount > 0, "INVALID_BURN_AMOUNT");
        require(exitMinAmounts.length == S.tokens.length, "INVALID_EXIT_AMOUNTS");

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            burnAmount: burnAmount,
            burnStorageID: 0,
            exitMinAmounts: exitMinAmounts,
            validUntil: uint32(block.timestamp + S.sharedConfig.maxForcedExitAge())
        });

        require(S.forcedExit[msg.sender].validUntil == 0, "DUPLICATE");
        require(S.forcedExitCount < S.sharedConfig.maxForcedExitCount(), "TOO_MANY_FORCED_EXITS");

        AmmUtil.transferIn(address(this), burnAmount);

        uint feeAmount = S.sharedConfig.forcedExitFee();
        if (feeAmount == 0) {
            require(msg.value == 0, "INVALID_ETH_VALUE");
        } else {
            AmmUtil.transferIn(address(0), feeAmount);
            AmmUtil.transferOut(address(0), feeAmount, S.exchange.owner());
        }

        S.forcedExit[msg.sender] = exit;
        S.forcedExitCount++;

        emit ForcedPoolExitRequested(exit);
    }

    function hash(
        bytes32 domainSeparator,
        AmmData.PoolExit memory exit
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLEXIT_TYPEHASH,
                    exit.owner,
                    exit.burnAmount,
                    exit.burnStorageID,
                    keccak256(abi.encodePacked(exit.exitMinAmounts)),
                    exit.validUntil
                )
            )
        );
    }

}
