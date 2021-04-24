// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/SignatureVerificationTransaction.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "./AmmData.sol";


/// @title AmmUtil
library AmmUtil
{
    using AddressUtil       for address;
    using BytesUtil         for bytes;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using TransactionReader for ExchangeData.Block;

    uint8 public constant L2_SIGNATURE_TYPE = 16;

    function verifySignatureL2(
        AmmData.Context memory ctx,
        address                owner,
        bytes32                txHash,
        bytes           memory signature
        )
        internal
        pure
    {
        // Check the signature type
        require(signature.toUint8Unsafe(0) == L2_SIGNATURE_TYPE, "INVALID_SIGNATURE_TYPE");

        /*
        // Read the signature verification transaction
        SignatureVerificationTransaction.SignatureVerification memory verification;
        SignatureVerificationTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, verification);

        // Verify that the hash was signed on L2
        require(
            verification.owner == owner &&
            verification.data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );
        */

        // Read the signature verification transaction
        // Start by reading the first 21 bytes into packedData
        uint txsDataPtr = ctx.txsDataPtr + 21;
        // packedData: txType (1) | owner (20)
        uint packedData;
        uint data;
        assembly {
            packedData := calldataload(txsDataPtr)
            data := calldataload(add(txsDataPtr, 36))
        }

        // Verify that the hash was signed on L2
        require(
            packedData & 0xffffffffffffffffffffffffffffffffffffffffff ==
            (uint(ExchangeData.TransactionType.SIGNATURE_VERIFICATION) << 160) | (uint(owner) & 0x00ffffffffffffffffffffffffffffffffffffffff) &&
            data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }

    function readTransfer(AmmData.Context memory ctx)
        internal
        pure
        returns (uint packedData, address to, address from)
    {
        // TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, transfer);

        // Start by reading the first 23 bytes into packedData
        uint txsDataPtr = ctx.txsDataPtr + 23;
        // packedData: txType (1) | type (1) | fromAccountID (4) | toAccountID (4) | tokenID (2) | amount (3) | feeTokenID (2) | fee (2) | storageID (4)
        assembly {
            packedData := calldataload(txsDataPtr)
            to := and(calldataload(add(txsDataPtr, 20)), 0xffffffffffffffffffffffffffffffffffffffff)
            from := and(calldataload(add(txsDataPtr, 40)), 0xffffffffffffffffffffffffffffffffffffffff)
        }
        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }

    function isAlmostEqualAmount(
        uint96 amount,
        uint96 targetAmount
        )
        internal
        pure
        returns (bool)
    {
        uint _amount = uint(amount) * 100000;
        uint _targetAmount = uint(targetAmount);
        // Max rounding error for a float24 is 2/100000
        // But relayer may use float rounding multiple times
        // so the range is expanded to [100000 - 8, 100000 + 8]
        return (100000 - 8) * _targetAmount <= _amount && _amount <= (100000 + 8) * _targetAmount;
    }

    function isAlmostEqualFee(
        uint96 amount,
        uint96 targetAmount
        )
        internal
        pure
        returns (bool)
    {
        if (targetAmount == 0) {
            return amount == 0;
        } else {
            // Max rounding error for a float16 is 5/1000
            uint ratio = (uint(amount) * 1000) / uint(targetAmount);
            return (1000 - 5) <= ratio && ratio <= (1000 + 5);
        }
    }
}
