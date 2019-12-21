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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../security/SecurityModule.sol";


/// @title PoolTogetherModule
contract PoolTogetherModule is SecurityModule
{
    constructor(Controller _controller)
        public
        SecurityModule(_controller)
    {
    }

    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  /*method*/,
        bytes   memory /*data*/
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
    }
}
