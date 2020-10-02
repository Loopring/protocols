// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
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
    using AddressUtil       for address;
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,uint96 burnAmount,uint32 burnStorageID,uint96[] exitMinAmounts,uint256 validUntil)"
    );

    event PoolExitRequested(AmmData.PoolExit exit);

    function exitPool(
        AmmData.State storage S,
        uint96                burnAmount,
        uint32                burnStorageID,
        uint96[]     calldata exitMinAmounts
        )
        public
    {
        uint size = S.tokens.length - 1;
        require(exitMinAmounts.length == size, "INVALID_PARAM_SIZE");
        require(burnAmount > 0, "INVALID_BURN_AMOUNT");

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            burnAmount: burnAmount,
            burnStorageID: burnStorageID,
            exitMinAmounts: exitMinAmounts,
            validUntil: block.timestamp + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN()
        });

        // Approve the exit
        S.approvedTx[hash(S.domainSeparator, exit)] = exit.validUntil;
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
