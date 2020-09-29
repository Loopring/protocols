// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmExitRequest
library AmmExitRequest
{
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;

    bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
        "Withdraw(address owner,uint256[] amounts,uint256 validUntil,uint256 nonce)"
    );

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,uint96 burnAmount,bool burnFromLayer2,uint32 burnStorageID,uint96[] exitMinAmounts,bool exitToLayer2,uint256 validUntil)"
    );

    event PoolExitRequested(AmmData.PoolExit exit);

    function exitPool(
        AmmData.State storage S,
        AmmData.Direction     direction,
        uint96                burnAmount,
        uint32                burnStorageID,
        uint96[]     calldata exitMinAmounts
        )
        public
    {
        uint size = S.tokens.length - 1;
        require(exitMinAmounts.length == size, "INVALID_AMOUNTS_SIZE");

        if (direction == AmmData.Direction.L1_TO_L1 ||
            direction == AmmData.Direction.L1_TO_L2) {
            require(burnStorageID == 0, "INVALID_STORAGE_ID");
            AmmUtil.transferIn(address(this), burnAmount);
        }

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            direction: direction,
            burnAmount: burnAmount,
            burnStorageID: burnStorageID,
            exitMinAmounts: exitMinAmounts,
            validUntil: 0xffffffff
        });

        // Approve the exit
        bytes32 txHash = hash(S.domainSeparator, exit);
        S.approvedTx[txHash] = block.timestamp;

        emit PoolExitRequested(exit);
    }

    function hash(
        bytes32                 domainSeparator,
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
                    exit.direction,
                    exit.burnAmount,
                    exit.burnStorageID,
                    keccak256(abi.encodePacked(exit.exitMinAmounts)),
                    exit.validUntil
                )
            )
        );
    }

    function _checkOperatorApproval(
        AmmData.State storage S,
        uint[]       calldata amounts,
        bytes        calldata signature, // signature from Exchange operator
        uint                  validUntil
        )
        private
        returns (bool)
    {
        // Check if we can withdraw without unlocking with an approval
        // from the operator.
        if (signature.length == 0) {
            require(validUntil == 0, "INVALID_VALUE");
            return false;
        }

        require(validUntil >= block.timestamp, 'SIGNATURE_EXPIRED');

        bytes32 withdrawHash = EIP712.hashPacked(
            S.domainSeparator,
            keccak256(
                abi.encode(
                    WITHDRAW_TYPEHASH,
                    msg.sender,
                    keccak256(abi.encodePacked(amounts)),
                    validUntil,
                    S.nonces[msg.sender]++
                )
            )
        );
        require(
            withdrawHash.verifySignature(S.exchange.owner(), signature),
            "INVALID_SIGNATURE"
        );
        return true;
    }
}
