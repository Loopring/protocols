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

import "./IMinerRegistry.sol";


/// @title An Implementation of IMinerRegistry.
/// @author Daniel Wang - <daniel@loopring.org>.
contract MinerRegistry is IMinerRegistry {
    struct Miner {
        uint    pos;        // 0 mens unregistered; if > 0, pos - 1 is the
                            // token's position in `addresses`.
        address owner;
        address addr;
    }

    mapping(address => Miner[]) public minerListMap;
    mapping(address => mapping(address => Miner)) public minerMap;

    /// @dev Disable default function.
    function ()
        payable
        external
    {
        revert();
    }

    function isMinerRegistered(
        address feeRecipient,
        address miner 
        )
        external
        view
        returns(bool)
    {
        Miner storage m = minerMap[feeRecipient][miner];
        return (m.addr == miner);
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
        Miner[] storage _miners = minerListMap[feeRecipient];
        uint size = _miners.length;

        if (start >= size) {
            return;
        }

        uint end = start + count;
        if (end > size) {
            end = size;
        }

        if (start == end) {
            return;
        }

        miners = new address[](end - start);
        for (uint i = start; i < end; i++) {
            miners[i - start] = _miners[i].addr;
        }
    }

    function registerMiner(
        address miner
        )
        external
    {
        require(0x0 != miner, "bad miner");
        require(
            0 == minerMap[msg.sender][miner].pos,
            "miner already exists"
        );

        Miner[] storage miners = minerListMap[msg.sender];
        Miner memory m = Miner(
            miners.length + 1,
            msg.sender,
            miner
        );

        miners.push(m);
        minerMap[msg.sender][miner] = m;

        emit MinerRegistered(
            msg.sender,
            miner
        );
    }

    function unregisterMiner(
        address miner
        )
        external
    {
        require(0x0 != miner, "bad miner");
        require(
            minerMap[msg.sender][miner].addr == miner,
            "miner not found"
        );

        Miner storage m = minerMap[msg.sender][miner];
        Miner[] storage miners = minerListMap[msg.sender];
        Miner storage lastMiner = miners[miners.length - 1];

        if (lastMiner.addr != miner) {
            // Swap with the last token and update the pos
            lastMiner.pos = m.pos;
            miners[lastMiner.pos - 1] = lastMiner;
            minerMap[lastMiner.owner][lastMiner.addr] = lastMiner;
        }

        miners.length--;
        delete minerMap[msg.sender][miner];

        emit MinerUnregistered(msg.sender, miner);
    }

    function unregisterAllMiners()
        external
    {
        Miner[] storage miners = minerListMap[msg.sender];

        for (uint i = 0; i < miners.length; i++) {
            delete minerMap[msg.sender][miners[i].addr];
        }
        delete minerListMap[msg.sender];

        emit AllMinersUnregistered(msg.sender);
    }
}
