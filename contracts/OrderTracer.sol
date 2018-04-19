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
pragma solidity 0.4.21;


/// @title OrderTracer
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract OrderTracer {

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public cancelledOrFilled;

    // This map is used to keep trace of order's cancellation history.
    mapping (bytes32 => uint) public cancelled;

    // A map from address to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from address to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

    function addCancelled(bytes32 orderHash, uint cancelAmount)
        onlyAuthorized
        external
    {
        cancelled[orderHash] = cancelled[orderHash].add(cancelAmount);
    }

    function addCancelledOrFilled(bytes32 orderHash, uint cancelOrFillAmount)
        onlyAuthorized
        external
    {
        cancelledOrFilled[orderHash] = cancelledOrFilled[orderHash].add(cancelOrFillAmount);
    }

    function setCutoffs(uint t)
        onlyAuthorized
        external
    {
        cutoffs[tx.origin] = t;
    }

    function setTradingPairCutoffs(bytes20 tokenPair, uint t)
        onlyAuthorized
        external
    {
        tradingPairCutoffs[tx.origin][tokenPair] = t;
    }

}
