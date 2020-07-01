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
import "../../lib/BytesUtil.sol";
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

        address owner = data.bytesToAddress(offset);
        offset += 20;
        uint24 accountID = data.bytesToUint24(offset);
        offset += 3;
        uint16 tokenID = data.bytesToUint16(offset);
        offset += 2;
        uint96 amount = data.bytesToUint96(offset);
        offset += 12;
        uint96 index = data.bytesToUint96(offset);
        offset += 12;

        // Make sure the deposit was actually done (this also verifies the index is correct)
        require(S.pendingDeposits[owner][tokenID][index].timestamp > 0, "DEPOSIT_DOESNT_EXIST");

        if (S.pendingDeposits[owner][tokenID][index].amount > 0) {
            // Earn a fee relative to the amount actually processed
            feeETH = uint(S.pendingDeposits[owner][tokenID][index].fee).mul(amount) / S.pendingDeposits[owner][tokenID][index].amount;

            // Consume what was deposited
            S.pendingDeposits[owner][tokenID][index].amount = uint96(uint(S.pendingDeposits[owner][tokenID][index].amount).sub(amount));
            S.pendingDeposits[owner][tokenID][index].fee = uint64(uint(S.pendingDeposits[owner][tokenID][index].fee).sub(feeETH));
        }

        emit DepositConsumed(owner, accountID, tokenID, amount, index);
    }
}
