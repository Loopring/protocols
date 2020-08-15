// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";


/// @title DepositTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library DepositTransaction
{
    using BytesUtil for bytes;
    using MathUint  for uint;

    struct Deposit
    {
        address owner;
        uint16  tokenID;
        uint    amount;
    }

    /*event DepositProcessed(
        address owner,
        uint32  accountId,
        uint16  token,
        uint    amount
    );*/

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  /*ctx*/,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  /*auxiliaryData*/
        )
        internal
        returns (uint)
    {
        // Read in the deposit
        Deposit memory deposit = readTx(data, offset);

        // Process the deposit
        ExchangeData.Deposit memory pendingDeposit = S.pendingDeposits[deposit.owner][deposit.tokenID];
        // Make sure the deposit was actually done
        require(pendingDeposit.timestamp > 0, "DEPOSIT_DOESNT_EXIST");
        // Earn a fee relative to the amount actually made available on layer 2.
        // This is done to ensure the user can do multiple deposits after each other
        // without invalidating work done by the owner for previous deposit amounts.

        // Also note the original deposit.amount can be zero!
        if (deposit.amount > 0) {
            require(pendingDeposit.amount >= deposit.amount, "INVALID_AMOUNT");
            pendingDeposit.amount = uint96(uint(pendingDeposit.amount).sub(deposit.amount));
        }

        // If the deposit was fully consumed, reset it so the storage is freed up
        // and the owner receives a gas refund.
        if (pendingDeposit.amount == 0) {
            delete S.pendingDeposits[deposit.owner][deposit.tokenID];
        } else {
            S.pendingDeposits[deposit.owner][deposit.tokenID] = pendingDeposit;
        }

        //emit DepositProcessed(owner, accountID, tokenID, amount);
    }

    function readTx(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (Deposit memory deposit)
    {
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        deposit.owner = data.toAddress(offset);
        offset += 20;
        //uint32 accountID = data.toUint32(offset);
        offset += 4;
        deposit.tokenID = data.toUint16(offset);
        offset += 2;
        deposit.amount = data.toUint96(offset);
        offset += 12;
    }
}
