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

    function verifySignatureL2(
        AmmData.Context     memory  ctx,
        ExchangeData.Block  memory  _block,
        address                     owner,
        bytes32                     txHash,
        bytes               memory  signature
        )
        internal
        pure
    {
        // Check the signature type
        require(signature.toUint8(0) == 16, "INVALID_SIGNATURE_TYPE");

        // Read the signature verification transaction
        SignatureVerificationTransaction.SignatureVerification memory verification = _block.readSignatureVerification(ctx.txIdx++);

        // Verify that the hash was signed on L2
        require(
            verification.owner == owner &&
            verification.data == uint(txHash) >> 3,
            "INVALID_L2_SIGNATURE"
        );
    }

    function approveTransfer(
        AmmData.Context  memory  ctx,
        TransferTransaction.Transfer memory transfer
        )
        internal
        pure
    {
        transfer.validUntil = 0xffffffff;
        transfer.maxFee = transfer.fee;
        bytes32 hash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
        approveExchangeTransaction(ctx.transactionBuffer, transfer.from, hash);
    }

    function approveExchangeTransaction(
        AmmData.TransactionBuffer memory buffer,
        address                          owner,
        bytes32                          txHash
        )
        internal
        pure
    {
        buffer.owners[buffer.size] = owner;
        buffer.txHashes[buffer.size] = txHash;
        buffer.size++;
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
            uint ratio = (amount * 100000) / targetAmount;
            return (100000 - 2) <= ratio && ratio <= (100000 + 2);
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
            uint ratio = (amount * 1000) / targetAmount;
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
