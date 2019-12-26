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

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "./ExchangeData.sol";
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
            S.lrcAddress.safeTransferFromAndVerify(msg.sender, feeVault, amountToBurn);
        }

        ExchangeData.Token memory token = ExchangeData.Token(tokenAddress, false);
        S.tokens.push(token);
        tokenID = uint16(S.tokens.length - 1);
        S.tokenToTokenId[tokenAddress] = tokenID + 1;

        emit TokenRegistered(tokenAddress, tokenID);
    }

    function getTokenID(
        ExchangeData.State storage S,
        address tokenAddress
        )
        public
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
