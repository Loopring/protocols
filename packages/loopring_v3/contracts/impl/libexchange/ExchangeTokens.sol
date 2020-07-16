// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;
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
        address indexed token,
        uint16  indexed tokenId
    );

    function registerToken(
        ExchangeData.State storage S,
        address tokenAddress
        )
        external
        returns (uint16 tokenID)
    {
        tokenID = registerToken(
            S,
            tokenAddress,
            getLRCFeeForRegisteringOneMoreToken(S)
        );
    }

    function getTokenAddress(
        ExchangeData.State storage S,
        uint16 tokenID
        )
        external
        view
        returns (address)
    {
        require(tokenID < S.tokens.length, "INVALID_TOKEN_ID");
        return S.tokens[tokenID].token;
    }

    function getLRCFeeForRegisteringOneMoreToken(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint feeLRC)
    {
        return S.loopring.tokenRegistrationFeeLRCBase().add(
            S.loopring.tokenRegistrationFeeLRCDelta().mul(S.tokens.length)
        );
    }

    function registerToken(
        ExchangeData.State storage S,
        address tokenAddress,
        uint    amountToBurn
        )
        public
        returns (uint16 tokenID)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(S.tokenToTokenId[tokenAddress] == 0, "TOKEN_ALREADY_EXIST");
        require(S.tokens.length < ExchangeData.MAX_NUM_TOKENS(), "TOKEN_REGISTRY_FULL");

        if (amountToBurn > 0) {
            address feeVault = S.loopring.protocolFeeVault();
            S.loopring.lrcAddress().safeTransferFromAndVerify(msg.sender, feeVault, amountToBurn);
        }

        ExchangeData.Token memory token = ExchangeData.Token(
            tokenAddress,
            false
        );
        S.tokens.push(token);
        tokenID = uint16(S.tokens.length - 1);
        S.tokenToTokenId[tokenAddress] = tokenID + 1;

        emit TokenRegistered(tokenAddress, tokenID);
    }

    function getTokenID(
        ExchangeData.State storage S,
        address tokenAddress
        )
        internal  // inline call
        view
        returns (uint16 tokenID)
    {
        tokenID = S.tokenToTokenId[tokenAddress];
        require(tokenID != 0, "TOKEN_NOT_FOUND");
        tokenID = tokenID - 1;
    }

    function disableTokenDeposit(
        ExchangeData.State storage S,
        address tokenAddress
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(tokenAddress != address(0), "ETHER_CANNOT_BE_DISABLED");
        require(tokenAddress != S.loopring.wethAddress(), "WETH_CANNOT_BE_DISABLED");
        require(tokenAddress != S.loopring.lrcAddress(), "LRC_CANNOT_BE_DISABLED");

        uint16 tokenID = getTokenID(S, tokenAddress);
        ExchangeData.Token storage token = S.tokens[tokenID];
        require(!token.depositDisabled, "TOKEN_DEPOSIT_ALREADY_DISABLED");
        token.depositDisabled = true;
    }

    function enableTokenDeposit(
        ExchangeData.State storage S,
        address tokenAddress
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        uint16 tokenID = getTokenID(S, tokenAddress);
        ExchangeData.Token storage token = S.tokens[tokenID];
        require(token.depositDisabled, "TOKEN_DEPOSIT_ALREADY_ENABLED");
        token.depositDisabled = false;
    }
}
