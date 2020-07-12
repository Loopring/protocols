// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.10;
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
    using BytesUtil            for bytes;
    using MathUint             for uint;

    event DepositConsumed(
        address indexed owner,
        uint24  indexed accountId,
        uint16          token,
        uint            amount,
        uint            index
    );

    function process(
        ExchangeData.State storage S,
        bytes memory data,
        bytes memory /*auxiliaryData*/
        )
        internal
        returns (uint feeETH)
    {
        uint offset = 1;

        // Read in the deposit data
        address owner = data.toAddress(offset);
        offset += 20;
        uint24 accountID = data.toUint24(offset);
        offset += 3;
        uint16 tokenID = data.toUint16(offset);
        offset += 2;
        uint96 amount = data.toUint96(offset);
        offset += 12;
        uint96 index = data.toUint96(offset);
        offset += 12;

        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID][index];
        // Make sure the deposit was actually done (this also verifies the index is correct)
        require(deposit.timestamp > 0, "DEPOSIT_DOESNT_EXIST");
        // Earn a fee relative to the amount actually made available on layer 2.
        // This is done to ensure the user can do multiple deposits after each other
        // without invalidating work done by the operator for previous deposit amounts.
        if (amount > 0 && deposit.amount > 0) {
            feeETH = uint(deposit.fee).mul(amount) / deposit.amount;
            deposit.fee = uint64(uint(deposit.fee).sub(feeETH));
        }
        // Consume what was deposited
        deposit.amount = uint96(uint(deposit.amount).sub(amount));

        // If the deposit was fully consumed, reset it so the storage is freed up
        // and the operator receives a gas refund.
        if (deposit.amount == 0) {
            // Give the operator the remaining fee
            feeETH = feeETH.add(uint(deposit.fee));
            // Reset the deposit data
            deposit.fee = 0;
            deposit.timestamp = 0;
        }

        emit DepositConsumed(owner, accountID, tokenID, amount, index);
    }
}
