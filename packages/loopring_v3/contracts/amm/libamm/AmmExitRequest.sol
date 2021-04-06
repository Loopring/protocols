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
        "PoolExit(address owner,uint96 burnAmount,uint32 burnStorageID,uint96[] exitMinAmounts,uint96 fee,uint32 validUntil)"
    );

    event PoolExitRequested(AmmData.PoolExit exit, bool force);

    function exitPool(
        AmmData.State storage S,
        uint96                burnAmount,
        uint96[]     calldata exitMinAmounts,
        bool                  force
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
            fee: 0,
            validUntil: uint32(block.timestamp + S.sharedConfig.maxForcedExitAge())
        });

        if (force) {
            require(S.forcedExit[msg.sender].validUntil == 0, "DUPLICATE");
            require(S.forcedExitCount < S.sharedConfig.maxForcedExitCount(), "TOO_MANY_FORCED_EXITS");

            AmmUtil.transferIn(address(this), burnAmount);

            uint feeAmount = S.sharedConfig.forcedExitFee();
            AmmUtil.transferIn(address(0), feeAmount);
            AmmUtil.transferOut(address(0), feeAmount, S.exchange.owner());

            S.forcedExit[msg.sender] = exit;
            S.forcedExitCount++;
        } else {
            AmmUtil.transferIn(address(0), 0);

            bytes32 txHash = hash(S.domainSeparator, exit);
            S.approvedTx[txHash] = true;
        }

        emit PoolExitRequested(exit, force);
    }

    function hash(
        bytes32 domainSeparator,
        AmmData.PoolExit memory exit
        )
        internal
        pure
        returns (bytes32 h)
    {
        /*return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLEXIT_TYPEHASH,
                    exit.owner,
                    exit.burnAmount,
                    exit.burnStorageID,
                    keccak256(abi.encodePacked(exit.exitMinAmounts)),
                    exit.fee,
                    exit.validUntil
                )
            )
        );*/
        bytes32 typeHash = POOLEXIT_TYPEHASH;
        address owner = exit.owner;
        uint burnAmount = exit.burnAmount;
        uint burnStorageID = exit.burnStorageID;
        uint96[] memory exitMinAmounts = exit.exitMinAmounts;
        uint fee = exit.fee;
        uint validUntil = exit.validUntil;
        assembly {
            let data := mload(0x40)
            mstore(    data      , typeHash)
            mstore(add(data,  32), owner)
            mstore(add(data,  64), burnAmount)
            mstore(add(data,  96), burnStorageID)
            mstore(add(data, 128), keccak256(add(exitMinAmounts, 32), mul(mload(exitMinAmounts), 32)))
            mstore(add(data, 160), fee)
            mstore(add(data, 192), validUntil)
            let p := keccak256(data, 224)
            mstore(data, "\x19\x01")
            mstore(add(data,  2), domainSeparator)
            mstore(add(data, 34), p)
            h := keccak256(data, 66)
        }
    }
}
