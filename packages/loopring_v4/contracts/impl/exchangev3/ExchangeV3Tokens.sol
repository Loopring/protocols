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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../iface/exchangev3/IExchangeV3Tokens.sol";
import "../libexchange/ExchangeTokens.sol";

import "./ExchangeV3Core.sol";


/// @title IExchangeV3Tokens
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Tokens is IExchangeV3Tokens, ExchangeV3Core
{
    using ExchangeTokens      for ExchangeData.State;

    function getLRCFeeForRegisteringOneMoreToken()
        external
        view
        returns (uint)
    {
        return state.getLRCFeeForRegisteringOneMoreToken();
    }

    function registerToken(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
        returns (uint16)
    {
        return state.registerToken(tokenAddress);
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16)
    {
        return state.getTokenID(tokenAddress);
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address)
    {
        return state.getTokenAddress(tokenID);
    }

    function getToken(
        uint16 tokenID
        )
        external
        view
        returns (ExchangeData.Token memory)
    {
        return state.getToken(tokenID);
    }

    function getToken(
        address tokenAddress
        )
        public
        view
        returns (ExchangeData.Token memory)
    {
        return state.getToken(tokenAddress);
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
    {
        state.enableTokenDeposit(tokenAddress);
    }
}