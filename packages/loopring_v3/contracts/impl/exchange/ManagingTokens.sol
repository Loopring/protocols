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

import "../../iface/exchange/IManagingTokens.sol";

import "./ManagingAccounts.sol";

/// @title An Implementation of IManagingTokens.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingTokens is IManagingTokens, ManagingAccounts
{
    function registerToken(
        address token
        )
        public
        onlyOperator
        returns (uint16 tokenID)
    {
        require(tokenToTokenId[token] == 0, "TOKEN_ALREADY_EXIST");
        require(tokens.length < MAX_NUM_TOKENS, "TOKEN_REGISTRY_FULL");

        tokens.push(token);
        tokenID = uint16(tokens.length);
        tokenToTokenId[token] = tokenID;

        emit TokenRegistered(token, tokenID);
    }

    function getTokenID(
        address tokenAddress
        )
        public
        view
        returns (uint16 tokenID)
    {
        tokenID = tokenToTokenId[tokenAddress];
        require(tokenID != 0, "TOKEN_NOT_FOUND");
    }

    function getTokenAddress(
        uint16 tokenID
        )
        public
        view
        returns (address)
    {
        require(tokenID < tokens.length, "INVALID_TOKEN_ID");
        return tokens[tokenID - 1];
    }

}