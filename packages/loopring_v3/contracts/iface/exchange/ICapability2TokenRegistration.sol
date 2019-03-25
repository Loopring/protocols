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

import "./ICapability1BlockManagement.sol";


/// @title ICapability2TokenRegistration
/// @author Daniel Wang  - <daniel@loopring.org>
contract ICapability2TokenRegistration is ICapability1BlockManagement
{
    uint    public constant MAX_NUM_TOKENS = 2 ** 12; // =4096

    mapping (address => uint16) public tokenToTokenId;
    mapping (uint16 => address) public tokenIdToToken;
    uint16  public numTokensRegistered  = 0;

    event TokenRegistered(
        address token,
        uint16 tokenId
    );

    function registerToken(
        address token
        )
        public
        returns (uint16 tokenId);
}