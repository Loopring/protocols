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

import "../impl/Data.sol";
import "../lib/MultihashUtil.sol";


/// @title MiningHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library MiningHelper {

    function updateMinerAndInterceptor(
        Data.Mining mining
        )
        internal
        pure
    {

        if (mining.miner == 0x0) {
            mining.miner = mining.feeRecipient;
        }

        // We do not support any interceptors for now
        /* else { */
        /*     (bool registered, address interceptor) = ctx.minerBrokerRegistry.getBroker( */
        /*         mining.feeRecipient, */
        /*         mining.miner */
        /*     ); */
        /*     if (registered) { */
        /*         mining.interceptor = interceptor; */
        /*     } */
        /* } */
    }

    function updateHash(
        Data.Mining mining,
        Data.Ring[] rings
        )
        internal
        pure
    {
        bytes32 hash;
        assembly {
            let ring := mload(add(rings, 32))                               // rings[0]
            let ringHashes := mload(add(ring, 64))                          // ring.hash
            for { let i := 1 } lt(i, mload(rings)) { i := add(i, 1) } {
                ring := mload(add(rings, mul(add(i, 1), 32)))               // rings[i]
                ringHashes := xor(ringHashes, mload(add(ring, 64)))         // ring.hash
            }
            let data := mload(0x40)
            data := add(data, 12)
            // Store data back to front to allow overwriting data at the front because of padding
            mstore(add(data, 40), ringHashes)                               // ringHashes
            mstore(sub(add(data, 20), 12), mload(add(mining, 32)))          // mining.miner
            mstore(sub(data, 12),          mload(add(mining,  0)))          // mining.feeRecipient
            hash := keccak256(data, 72)                                     // 20 + 20 + 32
        }
        mining.hash = hash;
    }

    function checkMinerSignature(
        Data.Mining mining
        )
        internal
        view
        returns (bool)
    {
        if (mining.sig.length == 0) {
            return (msg.sender == mining.miner);
        } else {
            return MultihashUtil.verifySignature(
                mining.miner,
                mining.hash,
                mining.sig
            );
        }
    }

}
