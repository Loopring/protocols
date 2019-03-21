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

import "../iface/ITokenRegistry.sol";

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";

import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of ITokenRegistry.
/// @author Brecht Devos - <brecht@loopring.org>,
contract TokenRegistry is ITokenRegistry, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    event TokenRegistered(address tokenAddress, uint16 tokenID);

    struct Token
    {
        address tokenAddress;
        uint tier;
        uint tierValidUntil;
    }

    address public lrcAddress = address(0x0);
    address public wethAddress = address(0x0);

    Token[] public tokens;
    mapping (address => uint16) public tokenToTokenID;

    constructor(
        address _lrcAddress,
        address _wethAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), ZERO_ADDRESS);
        require(_wethAddress != address(0x0), ZERO_ADDRESS);
        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;

        // Register ETH
        uint16 ethTokenID = registerTokenInternal(address(0x0));
        setFixedTokenTier(ethTokenID, 3);

        // Register WETH
        uint16 wethTokenID = registerTokenInternal(wethAddress);
        setFixedTokenTier(wethTokenID, 3);

        // Register LRC
        uint16 lrcTokenID = registerTokenInternal(lrcAddress);
        setFixedTokenTier(lrcTokenID, 1);
    }

    function setFixedTokenTier(
        uint16 tokenID,
        uint tier
        )
        internal
    {
        Token storage token = tokens[tokenID];
        token.tier = tier;
        token.tierValidUntil = 0xFFFFFFFF;
    }

    // Q(dongw): how can people burn LRC to change tiers?
    function registerToken(
        address tokenAddress
        )
        external
        returns (uint16)
    {
        // Pay the fee
        uint fee = getTokenRegistrationFee();
        burn(msg.sender, fee);

        // Register the token
        return registerTokenInternal(tokenAddress);
    }

    function registerTokenInternal(
        address tokenAddress
        )
        internal
        returns (uint16)
    {
        require(tokenToTokenID[tokenAddress] == 0, ALREADY_EXIST);
        require(tokens.length < MAX_NUM_TOKENS, TOKEN_REGISTRY_FULL);

        // Add the token to the list
        uint16 tokenID = uint16(tokens.length);
        Token memory token = Token(
            tokenAddress,
            4,
            0
        );
        tokens.push(token);

        tokenToTokenID[tokenAddress] = tokenID + 1;
        emit TokenRegistered(tokenAddress, tokenID);

        return tokenID;
    }

    function getTokenRegistrationFee()
        public
        view
        returns (uint)
    {
        // Increase the fee the more tokens are registered
        return TOKEN_REGISTRATION_FEE_IN_LRC_BASE.add(TOKEN_REGISTRATION_FEE_IN_LRC_DELTA.mul(tokens.length));
    }

    function getTokenTier(
        uint24 tokenID
        )
        public
        view
        returns (uint tier)
    {
        Token storage token = tokens[tokenID];
        // Fall back to lowest tier
        tier = (now > token.tierValidUntil) ? 4 : token.tier;
    }

    function getBurnRate(
        uint24 tokenID
        )
        public
        view
        returns (uint16 burnRate)
    {
        uint tier = getTokenTier(tokenID);
        if (tier == 1) {
            burnRate = BURNRATE_TIER1;
        } else if (tier == 2) {
            burnRate = BURNRATE_TIER2;
        } else if (tier == 3) {
            burnRate = BURNRATE_TIER3;
        } else {
            burnRate = BURNRATE_TIER4;
        }
    }

    function upgradeTokenTier(
        address tokenAddress
        )
        external
        returns (bool)
    {
        require(tokenAddress != address(0x0), BURN_RATE_FROZEN);
        require(tokenAddress != lrcAddress, BURN_RATE_FROZEN);
        require(tokenAddress != wethAddress, BURN_RATE_FROZEN);

        uint16 tokenID = getTokenID(tokenAddress);
        uint currentTier = getTokenTier(tokenID);

        // Can't upgrade to a higher level than tier 1
        require(currentTier > 1, BURN_RATE_MINIMIZED);

        // Burn TIER_UPGRADE_COST_BIPS of total LRC supply
        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        uint totalSupply = LRC.totalSupply();
        uint amount = totalSupply.mul(TIER_UPGRADE_COST_BIPS) / 10000;
        bool success = LRC.burnFrom(msg.sender, amount);
        require(success, BURN_FAILURE);

        // Upgrade tier
        Token storage token = tokens[tokenID];
        token.tier = currentTier.sub(1);
        token.tierValidUntil = now.add(TIER_UPGRADE_DURATION);

        emit TokenTierUpgraded(tokenAddress, token.tier);

        return true;
    }

    function getTokenID(
        address tokenAddress
        )
        public
        view
        returns (uint16)
    {
        require(tokenToTokenID[tokenAddress] != 0, NOT_FOUND);
        return tokenToTokenID[tokenAddress] - 1;
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address)
    {
        require(tokenID < tokens.length, INVALID_TOKEN_ID);
        return tokens[tokenID].tokenAddress;
    }

    function burn(
        address from,
        uint amount
        )
        internal
    {
        require(
            BurnableERC20(lrcAddress).burnFrom(
                from,
                amount
            ),
            BURN_FAILURE
        );
    }
}
