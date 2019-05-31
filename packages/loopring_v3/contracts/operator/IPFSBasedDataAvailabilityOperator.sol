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
pragma solidity 0.5.7;


import "../iface/IExchange.sol";

import "./Operator.sol";


/// @title IPFSBasedDataAvailabilityOperator.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IPFSBasedDataAvailabilityOperator is Operator
{
    mapping (bytes32 => bytes) public ipfsHashMap;

    ///@dev Submit a block with an IPFS hash for offchain data file.
    function commitBlock(
        uint8   blockType,
        uint16  blockSize,
        bytes   calldata data
        )
        onlyOwner
        external
        returns (bytes32 merkleRootAfter)
    {
        require(data.length > 0, "empty ipfs multihash");
        merkleRootAfter = IExchange(exchange).commitBlock(
            blockType,
            blockSize,
            bytes("0")
        );
        ipfsHashMap[merkleRootAfter] = data;
    }
}