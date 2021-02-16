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
        AmmData.Context     memory  ctx,
        bytes               memory  txsData,
        address                     owner,
        bytes32                     txHash,
        bytes               memory  signature
        )
        internal
        pure
    {
        // Check the signature type
        require(signature.toUint8Unsafe(0) == L2_SIGNATURE_TYPE, "INVALID_SIGNATURE_TYPE");

        // Read the signature verification transaction
        SignatureVerificationTransaction.SignatureVerification memory verification;
        SignatureVerificationTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, verification);

        // Verify that the hash was signed on L2
        require(
            verification.owner == owner &&
            verification.data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );
    }

    function isAlmostEqualAmount(
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
            // Max rounding error for a float24 is 2/100000
            // But relayer may use float rounding multiple times
            // so the range is expanded to [100000 - 8, 100000 + 8]
            uint ratio = (uint(amount) * 100000) / uint(targetAmount);
            return (100000 - 8) <= ratio && ratio <= (100000 + 8);
        }
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

    function transferIn(
        address token,
        uint    amount
        )
        internal
    {
        if (token == address(0)) {
            require(msg.value == amount, "INVALID_ETH_VALUE");
        } else if (amount > 0) {
            token.safeTransferFromAndVerify(msg.sender, address(this), amount);
        }
    }

    function transferOut(
        address token,
        uint    amount,
        address to
        )
        internal
    {
        if (token == address(0)) {
            to.sendETHAndVerify(amount, gasleft());
        } else {
            token.safeTransferAndVerify(to, amount);
        }
    }
}
