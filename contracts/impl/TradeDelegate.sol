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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/ITradeDelegate.sol";
import "../lib/Authorizable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/Killable.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of ITradeDelegate.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract TradeDelegate is ITradeDelegate, Authorizable, Killable, NoDefaultFunc {
    using ERC20SafeTransfer for address;

    function batchTransfer(
        bytes32[] batch
        )
        external
        onlyAuthorized
        notSuspended
    {
        uint length = batch.length;
        require(length % 4 == 0, INVALID_SIZE);

        uint start = 68;
        uint end = start + length * 32;
        for (uint p = start; p < end; p += 128) {
            address token;
            address from;
            address to;
            uint amount;
            assembly {
                token := calldataload(add(p,  0))
                from := calldataload(add(p, 32))
                to := calldataload(add(p, 64))
                amount := calldataload(add(p, 96))
            }
            require(
                token.safeTransferFrom(
                    from,
                    to,
                    amount
                ),
                TRANSFER_FAILURE
            );
        }
    }
}
