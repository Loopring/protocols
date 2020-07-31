// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title DepositTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library DepositTransaction
{
    using BytesUtil for bytes;
    using MathUint  for uint;

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
        returns (uint feeETH)
    {
        // Read in the deposit data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        address owner = data.toAddress(offset);
        offset += 20;
        //uint32 accountID = data.toUint32(offset);
        offset += 4;
        uint16 tokenID = data.toUint16(offset);
        offset += 2;
        uint96 amount = data.toUint96(offset);
        offset += 12;

        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID];
        // Make sure the deposit was actually done
        require(deposit.timestamp > 0, "DEPOSIT_DOESNT_EXIST");
        // Earn a fee relative to the amount actually made available on layer 2.
        // This is done to ensure the user can do multiple deposits after each other
        // without invalidating work done by the owner for previous deposit amounts.

        // Also note the original deposit.amount can be zero!
        if (amount > 0) {
            require(deposit.amount >= amount, "INVALID_AMOUNT");
            feeETH = deposit.amount == amount?
                uint(deposit.fee):
                uint(deposit.fee).mul(amount) / deposit.amount;

            deposit.fee = uint64(uint(deposit.fee).sub(feeETH));
            deposit.amount = uint96(uint(deposit.amount).sub(amount));
        }

        // If the deposit was fully consumed, reset it so the storage is freed up
        // and the owner receives a gas refund.
        if (deposit.amount == 0) {
            // Give the owner the remaining fee
            feeETH = feeETH.add(uint(deposit.fee));
            // Reset the deposit data
            deposit.fee = 0;
            deposit.timestamp = 0;
        }

        //emit DepositProcessed(owner, accountID, tokenID, amount);
    }
}
