// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";

import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "./ExchangeMode.sol";


/// @title ExchangeTokens.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeTokens
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;

    event TokenRegistered(
        address tokenAddr,
        uint    tokenTid,
        uint16  tokenId
    );

    function getToken(
        ExchangeData.State storage S,
        uint16 tokenID
        )
        external
        view
        returns (ExchangeData.Token memory)
    {
        require(tokenID < S.tokens.length, "INVALID_TOKEN_ID");
        return S.tokens[tokenID];
    }

    function registerToken(
        ExchangeData.State storage S,
        ExchangeData.Token memory token
        )
        external
        returns (uint16 tokenID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.tokenToTokenId[token.addr][token.tid] == 0, "TOKEN_ALREADY_EXIST");
        require(S.tokens.length < ExchangeData.MAX_NUM_TOKENS(), "TOKEN_REGISTRY_FULL");

        tokenID = uint16(S.tokens.length);
        S.tokens.push(token);
        S.tokenToTokenId[token.addr][token.tid] = tokenID + 1;

        emit TokenRegistered(token.addr, token.tid, tokenID);
    }

    function getTokenID(
        ExchangeData.State storage S,
        ExchangeData.Token memory token
        )
        internal  // inline call
        view
        returns (uint16 tokenID)
    {
        tokenID = S.tokenToTokenId[token.addr][token.tid];
        require(tokenID != 0, "TOKEN_NOT_FOUND");
        tokenID = tokenID - 1;
    }
}
