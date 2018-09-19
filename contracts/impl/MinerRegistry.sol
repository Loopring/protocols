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

import "../iface/Errors.sol";
import "../iface/IMinerRegistry.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IMinerRegistry.
/// @author Daniel Wang - <daniel@loopring.org>.
contract MinerRegistry is IMinerRegistry, NoDefaultFunc, Errors {

    mapping (address => mapping (address => uint)) private positionMap;

    function isMinerRegistered(
        address feeRecipient,
        address miner
        )
        external
        view
        returns(bool)
    {
        return (positionMap[feeRecipient][miner] > 0);
    }

    function getMiners(
        address feeRecipient,
        uint    start,
        uint    count
        )
        external
        view
        returns (address[] miners)
    {
        require(false, UNIMPLEMENTED);
        return;
    }

    function registerMiner(
        address miner
        )
        external
    {
        require(0x0 != miner, ZERO_ADDRESS);
        require(
            0 == positionMap[msg.sender][miner],
            ALREADY_EXIST
        );

        address[] storage miners = minersMap[msg.sender];

        miners.push(miner);
        positionMap[msg.sender][miner] = miners.length;

        emit MinerRegistered(
            msg.sender,
            miner
        );
    }

    function unregisterMiner(
        address addr
        )
        external
    {
        require(0x0 != addr, ZERO_ADDRESS);

        uint pos = positionMap[msg.sender][addr];
        require(pos != 0, NOT_FOUND);

        address[] storage miners = minersMap[msg.sender];
        uint size = miners.length;

        if (pos != size) {
            address lastOne = miners[size - 1];
            miners[pos - 1] = lastOne;
            positionMap[msg.sender][lastOne] = pos;
        }

        miners.length -= 1;
        delete positionMap[msg.sender][addr];

        emit MinerUnregistered(msg.sender, addr);
    }

    function unregisterAllMiners()
        external
    {
        address[] storage miners = minersMap[msg.sender];

        for (uint i = 0; i < miners.length; i++) {
            delete positionMap[msg.sender][miners[i]];
        }
        delete minersMap[msg.sender];

        emit AllMinersUnregistered(msg.sender);
    }
}
