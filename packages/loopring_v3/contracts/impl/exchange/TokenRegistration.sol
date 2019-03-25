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

import "../../iface/exchange/ITokenRegistration.sol";
import "./BlockManagement.sol";

/// @title An Implementation of IDEX.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract TokenRegistration is ITokenRegistration, BlockManagement
{
    function registerToken(
        address token
        )
        public
        // onlyOwner
        returns (uint16 tokenId)
    {
        require(tokenToTokenId[token] == 0, "TOKEN_ALREADY_EXIST");
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

    function getTokenID(
        address tokenAddress
        )
        public
        view
        returns (uint16)
    {
        require(tokenToTokenId[tokenAddress] != 0, "TOKEN_NOT_FOUND");
        return tokenToTokenId[tokenAddress] - 1;
    }

    function getTokenAddress(
        uint16 tokenID
        )
        public
        view
        returns (address)
    {
        return tokenIdToToken[tokenID + 1];
    }

}