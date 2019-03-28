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

import "./IData.sol";


/// @title IManagingBlocks.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract IManagingBlocks is IData
{
    function isInWithdrawMode()
        public
        view
        returns (bool);

    function getBlockHeight()
        external
        view
        returns (uint);

    function commitBlock(
        uint blockType,
        bytes calldata data
        )
        external;

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external;

    function revertBlock(
        uint32 blockIdx
        )
        external;
}