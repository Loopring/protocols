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

import "../iface/ITradeHistory.sol";

import "../lib/Authorizable.sol";
import "../lib/MathUint.sol";
import "../lib/Killable.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of ITradeHistory.
/// @author Brecht Devos - <brecht@loopring.org>.
contract TradeHistory is ITradeHistory, Authorizable, Killable, NoDefaultFunc {
    using MathUint for uint;

    function batchUpdateFilled(
        bytes32[] filledInfo
        )
        external
        onlyAuthorized
        notSuspended
    {
        uint length = filledInfo.length;
        require(length % 2 == 0, INVALID_SIZE);

        uint start = 68;
        uint end = start + length * 32;
        for (uint p = start; p < end; p += 64) {
            bytes32 hash;
            uint filledAmount;
            assembly {
                hash := calldataload(add(p,  0))
                filledAmount := calldataload(add(p, 32))
            }
            filled[hash] = filledAmount;
        }
    }

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        external
        onlyAuthorized
        notSuspended
    {
        cancelled[broker][orderHash] = true;
    }

    function setCutoffs(
        address broker,
        uint    cutoff
        )
        external
        onlyAuthorized
        notSuspended
    {
        require(cutoffs[broker] < cutoff, INVALID_VALUE);
        cutoffs[broker] = cutoff;
    }

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint    cutoff
        )
        external
        onlyAuthorized
        notSuspended
    {
        require(tradingPairCutoffs[broker][tokenPair] < cutoff, INVALID_VALUE);
        tradingPairCutoffs[broker][tokenPair] = cutoff;
    }

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint    cutoff
        )
        external
        onlyAuthorized
        notSuspended
    {
        require(cutoffsOwner[broker][owner] < cutoff, INVALID_VALUE);
        cutoffsOwner[broker][owner] = cutoff;
    }

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint    cutoff
        )
        external
        onlyAuthorized
        notSuspended
    {
        require(tradingPairCutoffsOwner[broker][owner][tokenPair] < cutoff, INVALID_VALUE);
        tradingPairCutoffsOwner[broker][owner][tokenPair] = cutoff;
    }

    function batchGetFilledAndCheckCancelled(
        bytes32[] batch
        )
        external
        view
        returns (uint[] fills)
    {
        uint length = batch.length;
        require(length % 5 == 0, INVALID_SIZE);

        uint start = 68;
        uint end = start + length * 32;
        uint i = 0;
        fills = new uint[](length / 5);
        for (uint p = start; p < end; p += 160) {
            address broker;
            address owner;
            bytes32 hash;
            uint validSince;
            bytes20 tradingPair;
            assembly {
                broker := calldataload(add(p,  0))
                owner := calldataload(add(p, 32))
                hash := calldataload(add(p, 64))
                validSince := calldataload(add(p, 96))
                tradingPair := calldataload(add(p, 128))
            }
            bool valid = !cancelled[broker][hash];
            valid = valid && validSince > tradingPairCutoffs[broker][tradingPair];
            valid = valid && validSince > cutoffs[broker];
            valid = valid && validSince > tradingPairCutoffsOwner[broker][owner][tradingPair];
            valid = valid && validSince > cutoffsOwner[broker][owner];

            fills[i++] = valid ? filled[hash] : ~uint(0);
        }
    }
}
