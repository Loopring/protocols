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
    constructor(
        address _loopringAddress
        )
        public
    {
        ILoopringV3 loopring = ILoopringV3(_loopringAddress);

        registerTokenInternal(address(0));
        registerTokenInternal(loopring.wethAddress());
        registerTokenInternal(loopring.lrcAddress());
    }

    function registerToken(
        address tokenAddress
        )
        public
        onlyOperator
        returns (uint16 tokenID)
    {
        return registerTokenInternal(tokenAddress);
    }

    function registerTokenInternal(
        address tokenAddress
        )
        internal
        returns (uint16 tokenID)
    {
        require(tokenToTokenId[tokenAddress] == 0, "TOKEN_ALREADY_EXIST");
        require(tokens.length < MAX_NUM_TOKENS, "TOKEN_REGISTRY_FULL");

        Token memory token = Token(tokenAddress, false);
        tokens.push(token);
        tokenID = uint16(tokens.length);
        tokenToTokenId[tokenAddress] = tokenID;

        emit TokenRegistered(tokenAddress, tokenID);
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
        return tokens[tokenID - 1].token;
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
    {
        uint16 tokenID = getTokenID(tokenAddress);
        Token storage token = tokens[tokenID - 1];
        require(!token.depositDisabled, "TOKEN_DEPOSIT_ALREADY_DISABLED");
        token.depositDisabled = true;
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
    {
        uint16 tokenID = getTokenID(tokenAddress);
        Token storage token = tokens[tokenID - 1];
        require(token.depositDisabled, "TOKEN_DEPOSIT_ALREADY_ENABLED");
        token.depositDisabled = false;
    }
}