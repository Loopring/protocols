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

import "../../iface/exchange/ICapability2TokenRegistration.sol";

import "./Capability1BlockManagement.sol";

/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Capability2TokenRegistration is ICapability2TokenRegistration, Capability1BlockManagement
{
    function registerToken(
        address token
        )
        public
        // onlyOwner
        returns (uint16 tokenId)
    {
        require(tokenToTokenId[token] == 0, "ALREADY_EXIST");
        require(numTokensRegistered < MAX_NUM_TOKENS, "TOKEN_REGISTRY_FULL");

        tokenId = numTokensRegistered + 1;

        tokenToTokenId[token] = tokenId;
        tokenIdToToken[tokenId] = token;
        numTokensRegistered += 1;

        emit TokenRegistered(
            token,
            tokenId
        );
    }
}