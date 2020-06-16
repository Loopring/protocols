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
pragma solidity ^0.6.6;

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
    using SignatureUtil        for bytes32;

    event DepositConsumed(
        address indexed owner,
        uint24  indexed accountId,
        uint16          token,
        uint            amount
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
        uint amount = uint(data.bytesToUint24(offset)).decodeFloat(24);
        offset += 3;

        if (S.pendingDeposits[owner][tokenID].amount > 0) {
            // Earn a fee relative to the amount actually processed
            feeETH = uint(S.pendingDeposits[owner][tokenID].fee).mul(amount) / S.pendingDeposits[owner][tokenID].amount;

            // Consume what was deposited
            S.pendingDeposits[owner][tokenID].amount = uint96(uint(S.pendingDeposits[owner][tokenID].amount).sub(amount));
            S.pendingDeposits[owner][tokenID].fee = uint64(uint(S.pendingDeposits[owner][tokenID].fee).sub(feeETH));
        }

        emit DepositConsumed(owner, accountID, tokenID, amount);
    }
}
