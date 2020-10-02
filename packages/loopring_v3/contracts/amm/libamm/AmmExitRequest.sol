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
        "PoolExit(address owner,uint96 burnAmount,uint32 burnStorageID,uint96[] exitMinAmounts,uint64 validUntil)"
    );

    event PoolExitRequested(AmmData.PoolExit exit);

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
            validUntil: uint64(block.timestamp + AmmData.MAX_FORCED_EXIT_AGE())
        });

        bytes32 txHash = hash(S.domainSeparator, exit);
        require(S.forcedExit[txHash].validUntil == 0, "DUPLICATE");
        require(S.isExiting[msg.sender] == 0, "USER_EXSTING");
        require(S.forcedExitCount < AmmData.MAX_FORCED_EXIT_COUNT(), "TOO_MANY_FORCED_EXITS");

        AmmUtil.transferIn(address(this), burnAmount);

        exit.exitMinAmounts = new uint96[](0);
        S.forcedExit[txHash] = exit;
        S.isExiting[msg.sender] = txHash;
        S.forcedExitCount++;

        emit PoolExitRequested(exit);
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
