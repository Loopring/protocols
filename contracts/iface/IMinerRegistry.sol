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


/// @title IMinerRegistry
/// @dev A miner need to be registered so it can mine on behalf of other addresses.
/// @author Daniel Wang - <daniel@loopring.org>.
contract IMinerRegistry {
    mapping (address => address[]) public minersMap;

    event MinerRegistered(
        address feeRecipient,
        address miner
    );

    event MinerUnregistered(
        address feeRecipient,
        address miner
    );

    event AllMinersUnregistered(
        address feeRecipient
    );

    function isMinerRegistered(
        address feeRecipient,
        address miner
        )
        external
        view
        returns(bool);

    function getMiners(
        address feeRecipient,
        uint    start,
        uint    count
        )
        external
        view
        returns (address[] miners);

    // @dev this method must be called by feeRecipient.
    function registerMiner(
        address miner
        )
        external;

    // @dev this method must be called by feeRecipient.
    function unregisterMiner(
        address miner
        )
        external;

    // @dev this method must be called by feeRecipient.
    function unregisterAllMiners()
        external;
}
