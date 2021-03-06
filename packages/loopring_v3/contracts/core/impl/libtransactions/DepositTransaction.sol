// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/MathUint96.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";


/// @title DepositTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library DepositTransaction
{
    using BytesUtil   for bytes;
    using MathUint96  for uint96;

    struct Deposit
    {
        address to;
        uint32  toAccountID;
        uint16  tokenID;
        uint96  amount;
    }

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  /*ctx*/,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  /*auxiliaryData*/
        )
        internal
    {
        // Read in the deposit
        Deposit memory deposit;
        readTx(data, offset, deposit);
        if (deposit.amount == 0) {
            return;
        }

        // Process the deposit
        ExchangeData.Deposit memory pendingDeposit = S.pendingDeposits[deposit.to][deposit.tokenID];
        // Make sure the deposit was actually done
        require(pendingDeposit.timestamp > 0, "DEPOSIT_DOESNT_EXIST");

        // Processing partial amounts of the deposited amount is allowed.
        // This is done to ensure the user can do multiple deposits after each other
        // without invalidating work done by the exchange owner for previous deposit amounts.

        require(pendingDeposit.amount >= deposit.amount, "INVALID_DEPOSIT_AMOUNT");
        pendingDeposit.amount = pendingDeposit.amount.sub(deposit.amount);

        // If the deposit was fully consumed, reset it so the storage is freed up
        // and the owner receives a gas refund.
        if (pendingDeposit.amount == 0) {
            delete S.pendingDeposits[deposit.to][deposit.tokenID];
        } else {
            S.pendingDeposits[deposit.to][deposit.tokenID] = pendingDeposit;
        }
    }

    function readTx(
        bytes   memory data,
        uint           offset,
        Deposit memory deposit
        )
        internal
        pure
    {
        uint _offset = offset;

        require(data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.DEPOSIT), "INVALID_TX_TYPE");
        _offset += 1;

        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        deposit.to = data.toAddressUnsafe(_offset);
        _offset += 20;
        deposit.toAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        deposit.tokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        deposit.amount = data.toUint96Unsafe(_offset);
        _offset += 12;
    }
}
