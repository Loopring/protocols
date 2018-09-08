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

pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/ITaxTable.sol";
import "../lib/BurnableERC20.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TaxTable is ITaxTable, NoDefaultFunc {
    using MathUint for uint;

    address public lrcAddress = 0x0;
    address public wethAddress = 0x0;

    uint public constant YEAR_TO_SECONDS = 31556952;

    constructor(
        address _lrcAddress,
        address _wethAddress
        )
        public
    {
        require(_lrcAddress != 0x0, "LRC address needs to be valid");
        require(_wethAddress != 0x0, "WETH address needs to be valid");
        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;

        // Set fixed LRC and WETH tax rates
        setFixedTokenTier(lrcAddress, TIER_1);
        setFixedTokenTier(wethAddress, TIER_2);
    }

    function setFixedTokenTier(
        address token,
        uint tier
        )
        internal
        returns (uint)
    {
        TokenData storage tokenData = tokens[token];
        tokenData.validUntil = ~uint(0);
        tokenData.tier = tier;
    }

    function getTaxRate(
        address spender,
        address token,
        bool P2P
        )
        external
        view
        returns (uint16)
    {
        TokenData storage tokenData = tokens[token];
        uint tier = getTokenTier(tokenData);
        if (tier == TIER_1) {
            return (P2P ? TAX_P2P_TIER1 : TAX_MATCHING_TIER1);
        } else if (tokenData.tier == TIER_2) {
            return (P2P ? TAX_P2P_TIER2 : TAX_MATCHING_TIER2);
        } else if (tokenData.tier == TIER_3) {
            return (P2P ? TAX_P2P_TIER3 : TAX_MATCHING_TIER3);
        } else {
            return (P2P ? TAX_P2P_TIER4 : TAX_MATCHING_TIER4);
        }
    }

    function upgradeTokenTier(
        address token
        )
        external
        returns (bool)
    {
        require(token != 0x0, "Token address needs to be valid");
        require(token != lrcAddress, "LRC cannot be upgraded");
        require(token != wethAddress, "WETH cannot be upgraded");

        TokenData storage tokenData = tokens[token];
        uint currentTier = getTokenTier(tokenData);

        // Can't upgrade to a higher level than tier 1
        if (currentTier == TIER_1) {
            return false;
        }

        // Burn TIER_UPGRADE_COST_PERCENTAGE of total LRC supply
        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        uint totalSupply = LRC.totalSupply();
        uint amount = totalSupply.mul(TIER_UPGRADE_COST_PERCENTAGE) / BASE_PERCENTAGE;
        bool success = BurnableERC20(lrcAddress).burnFrom(msg.sender, amount);
        require(success, "Burn needs to succeed");

        // Upgrade tier
        tokenData.validUntil = now.add(2 * YEAR_TO_SECONDS);
        tokenData.tier = currentTier + 1;

        emit TokenTierUpgraded(token, tokenData.tier);

        return true;
    }

    function lock(
        uint amount
        )
        external
        returns (bool)
    {
        require(amount > 0, "Need to lock a non-zero amount of tokens");

        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        bool success = LRC.transferFrom(msg.sender, this, amount);
        require(success, "LRC transfer needs to succeed");

        UserData storage userData = balances[msg.sender];
        userData.amount = userData.amount.add(amount);
        userData.lockedSince = now; // TODO: weight factor

        return true;
    }

    function withdraw(
        uint amount
        )
        external
        returns (bool)
    {
        require(amount > 0, "Need to withdraw a non-zero amount of tokens");

        UserData storage userData = balances[msg.sender];

        uint withdrawableAmount = userData.amount; // TODO
        require(withdrawableAmount >= amount, "user needs to have sufficient funds he can withdraw");

        BurnableERC20 LRC = BurnableERC20(lrcAddress);
        bool success = LRC.transferFrom(msg.sender, this, amount);
        require(success, "LRC transfer needs to succeed");

        return true;
    }

    function getTokenTier(
        TokenData memory tokenData
        )
        internal
        view
        returns (uint)
    {
        uint tier = tokenData.tier;
        if(now > tokenData.validUntil) {
            // Fall back to lowest tier
            tier = TIER_4;
        }
        return tier;
    }

}
