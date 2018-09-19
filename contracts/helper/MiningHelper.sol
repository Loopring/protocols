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
        Data.Mining mining,
        Data.Context ctx
        )
        internal
        view
        returns (bytes32)
    {
        if (mining.miner == 0x0) {
            mining.miner = mining.feeRecipient;
        } else {
            (bool registered, address interceptor) = ctx.minerBrokerRegistry.getBroker(
                mining.feeRecipient,
                mining.miner
            );
            if (registered) {
                mining.interceptor = interceptor;
            }
        }
    }

    function updateHash(
        Data.Mining mining,
        Data.Ring[] rings
        )
        internal
        pure
    {
        bytes32 ringHashes = rings[0].hash;
        for (uint i = 1; i < rings.length; i++) {
            ringHashes ^= rings[i].hash;
        }
        mining.hash = keccak256(
            abi.encodePacked(
                mining.feeRecipient,
                mining.miner,
                ringHashes
            )
        );
    }

    function checkMinerSignature(
        Data.Mining mining
        )
        internal
        view
        returns (bool)
    {
        if (mining.sig.length == 0) {
            return (tx.origin == mining.miner);
        } else {
            return MultihashUtil.verifySignature(
                mining.miner,
                mining.hash,
                mining.sig
            );
        }
    }

}
