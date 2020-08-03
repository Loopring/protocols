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
        address token,
        uint    tid,
        uint16  tokenId
    );

    function getTokenAddress(
        ExchangeData.State storage S,
        uint16 tokenID
        )
        external
        view
        returns (address tokenAddress, uint tid)
    {
        require(tokenID < S.tokens.length, "INVALID_TOKEN_ID");
        ExchangeData.Token memory token = S.tokens[tokenID];
        tokenAddress = token.token;
        tid = token.tid;
    }

    function registerToken(
        ExchangeData.State storage S,
        address tokenAddress,
        uint    tid
        )
        external
        returns (uint16 tokenID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.tokenToTokenId[tokenAddress][tid] == 0, "TOKEN_ALREADY_EXIST");
        require(S.tokens.length < ExchangeData.MAX_NUM_TOKENS(), "TOKEN_REGISTRY_FULL");

        ExchangeData.Token memory token = ExchangeData.Token(
            tokenAddress,
            tid
        );
        tokenID = uint16(S.tokens.length);
        S.tokens.push(token);
        S.tokenToTokenId[tokenAddress][tid] = tokenID + 1;

        emit TokenRegistered(tokenAddress, tid, tokenID);
    }

    function getTokenID(
        ExchangeData.State storage S,
        address tokenAddress,
        uint    tid
        )
        internal  // inline call
        view
        returns (uint16 tokenID)
    {
        tokenID = S.tokenToTokenId[tokenAddress][tid];
        require(tokenID != 0, "TOKEN_NOT_FOUND");
        tokenID = tokenID - 1;
    }
}
