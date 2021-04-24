// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/TransferUtil.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";


/// @title AmmExitRequest
library AmmExitRequest
{
    using TransferUtil for address;
    using TransferUtil for address payable;

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

        address eth = address(0);
        if (force) {
            require(S.forcedExit[msg.sender].validUntil == 0, "DUPLICATE");
            require(S.forcedExitCount < S.sharedConfig.maxForcedExitCount(), "TOO_MANY_FORCED_EXITS");

            address(this).transferIn(msg.sender, burnAmount);

            uint feeAmount = S.sharedConfig.forcedExitFee();
            eth.transferIn(msg.sender, feeAmount);
            eth.transferOut(S.exchange.owner(), feeAmount);

            S.forcedExit[msg.sender] = exit;
            S.forcedExitCount++;
        } else {
            eth.transferIn(msg.sender, 0);

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
