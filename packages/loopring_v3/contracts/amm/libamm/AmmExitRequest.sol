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

    // TODO:fix this string
    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,bool burnFromLayer2,uint96 burnAmount,bool burnFromLayer2,uint32 burnStorageID,bool exitToLayer2,uint96[] exitMinAmounts,uint256 validUntil,uint32 nonce)"
    );

    event PoolExitRequested(AmmData.PoolExit exit);

    function exitPool(
        AmmData.State storage S,
        bool                  burnFromLayer2,
        uint96                burnAmount,
        uint32                burnStorageID,
        bool                  exitToLayer2,
        uint96[]     calldata exitMinAmounts
        )
        public
    {
        uint size = S.tokens.length - 1;
        require(exitMinAmounts.length == size, "INVALID_PARAM_SIZE");
        require(burnAmount > 0, "INVALID_BURN_AMOUNT");

        uint32 nonce = 0;
        if (!burnFromLayer2) {
            require(burnStorageID == 0, "INVALID_STORAGE_ID");
            require(S.exitLockNonce[msg.sender] == 0, "ONLY_ONE_LAYER1_EXIT_PER_USER_ALLOWED");

            nonce = uint32(S.exitLocks.length + 1);
            require(
                nonce <= S.exitLocksIndex + AmmData.MAX_NUM_EXITS_FROM_LAYER1(),
                "TOO_MANY_LAYER1_EXITS"
            );

            AmmUtil.transferIn(address(this), burnAmount);
        }

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            burnFromLayer2: burnFromLayer2,
            burnAmount: burnAmount,
            burnStorageID: burnStorageID,
            exitToLayer2: exitToLayer2,
            exitMinAmounts: exitMinAmounts,
            validUntil: block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN(),
            nonce: nonce
        });

        // Approve the exit
        bytes32 txHash = hash(S.domainSeparator, exit);
        S.approvedTx[txHash] = exit.validUntil;

        // Put layer-1 exit into the queue
        if (!burnFromLayer2) {
            S.exitLocks.push(AmmData.TokenLock({
                amounts: AmmUtil.array(burnAmount)
            }));

            S.exitLockNonce[msg.sender] = nonce;
        }

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
                    exit.burnFromLayer2,
                    exit.burnAmount,
                    exit.burnStorageID,
                    exit.exitToLayer2,
                    keccak256(abi.encodePacked(exit.exitMinAmounts)),
                    exit.validUntil,
                    exit.nonce
                )
            )
        );
    }

    // bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
    //     "Withdraw(address owner,uint256[] amounts,uint256 validUntil,uint256 nonce)"
    // );

    // function _checkOperatorApproval(
    //     AmmData.State storage S,
    //     uint[]       calldata amounts,
    //     bytes        calldata signature, // signature from Exchange operator
    //     uint                  validUntil
    //     )
    //     private
    //     returns (bool)
    // {
    //     // Check if we can withdraw without unlocking with an approval
    //     // from the operator.
    //     if (signature.length == 0) {
    //         require(validUntil == 0, "INVALID_VALUE");
    //         return false;
    //     }

    //     require(validUntil >= block.timestamp, 'SIGNATURE_EXPIRED');

    //     bytes32 withdrawHash = EIP712.hashPacked(
    //         S.domainSeparator,
    //         keccak256(
    //             abi.encode(
    //                 WITHDRAW_TYPEHASH,
    //                 msg.sender,
    //                 keccak256(abi.encodePacked(amounts)),
    //                 validUntil,
    //                 S.nonces[msg.sender]++
    //             )
    //         )
    //     );
    //     require(
    //         withdrawHash.verifySignature(S.exchange.owner(), signature),
    //         "INVALID_SIGNATURE"
    //     );
    //     return true;
    // }
}
