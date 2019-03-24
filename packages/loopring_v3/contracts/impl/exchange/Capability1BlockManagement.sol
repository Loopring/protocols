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
pragma solidity 0.5.2;

import "../../iface/exchange/ICapability1BlockManagement.sol";

import "./CapabilityBase.sol";


/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Capability1BlockManagement is ICapability1BlockManagement, CapabilityBase
{
    function setCommitter(address _committer)
        external
        // onlyOwner
        returns (address oldCommitter)
    {
        require(address(0) != _committer, "ZERO_ADDRESS");
        oldCommitter = committer;
        committer = _committer;

        emit CommitterChanged(
            id,
            oldCommitter,
            committer
        );
    }

    function commitBlock(
        uint  blockType,
        bytes calldata data
        )
        external
        onlyCommitter
    {
        commitBlockInternal(blockType, data);
    }

    modifier onlyCommitter()
    {
        require(msg.sender == committer, "UNAUTHORIZED");
        _;
    }

    function commitBlockInternal(
        uint  blockType,
        bytes memory data
        )
        internal
    {
        //...

        emit BlockCommitted(
            id,
            blockType
        );
    }

}