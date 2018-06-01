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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../impl/Data.sol";
import "../lib/MultihashUtil.sol";


/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
library MiningHelper {

    function updateMinerAndInterceptor(
        Data.Mining mining,
        Data.Context ctx
        )
        public
        view
        returns (bytes32)
    {
        if (mining.miner == 0x0) {
            mining.miner = mining.feeRecipient;
        } else {
            bool registered;
            (registered, mining.interceptor) = ctx.minerBrokerRegistry.getBroker(
                mining.feeRecipient,
                mining.miner
            );
            require(registered, "miner unregistered");
        }
    }

    function updateHash(
        Data.Mining mining
        )
        public
        pure
    {
        mining.hash = keccak256(
            mining.feeRecipient,
            mining.miner,
            mining.hash
        );
    }
    function checkMinerSignature(
        Data.Mining mining,
        Data.Context ctx
        )
        public
        view
    {
        if (mining.sig.length == 0) {
            require(tx.origin == mining.miner);
        } else {
            MultihashUtil.verifySignature(
                mining.miner,
                mining.hash,
                mining.sig
            );
        }
    }

}