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

pragma solidity 0.5.7;

import "../iface/IBurnRateTable.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract BurnRateTable is IBurnRateTable, NoDefaultFunc {
    using MathUint for uint;
    using ERC20SafeTransfer for address;

    address public lrcAddress = address(0x0);

    constructor(
        address _lrcAddress,
        address _wethAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), ZERO_ADDRESS);
        lrcAddress = _lrcAddress;

        setFixedTokenTier(lrcAddress, TIER_1);
    }

    function setFixedTokenTier(
        address token,
        uint tier
        )
        internal
    {
        TokenData storage tokenData = tokens[token];
        tokenData.validUntil = ~uint(0);
        tokenData.tier = tier;
    }

    function getBurnRate(
        address token
        )
        external
        view
        returns (uint32 burnRate)
    {
        uint tier = getTokenTier(token);
        if (tier == TIER_1) {
            burnRate = uint32(BURN_P2P_TIER1) * 0x10000 + BURN_MATCHING_TIER1;
        } else if (tier == TIER_2) {
            burnRate = uint32(BURN_P2P_TIER2) * 0x10000 + BURN_MATCHING_TIER2;
        } else if (tier == TIER_3) {
            burnRate = uint32(BURN_P2P_TIER3) * 0x10000 + BURN_MATCHING_TIER3;
        } else {
            burnRate = uint32(BURN_P2P_TIER4) * 0x10000 + BURN_MATCHING_TIER4;
        }
    }

    function upgradeTokenTier(
        address token
        )
        external
        returns (bool)
    {
        require(token != address(0x0), ZERO_ADDRESS);
        require(token != lrcAddress, BURN_RATE_FROZEN);

        uint currentTier = getTokenTier(token);

        // Can't upgrade to a higher level than tier 1
        require(currentTier != TIER_1, BURN_RATE_MINIMIZED);

        // Burn TIER_UPGRADE_COST_PERCENTAGE of total LRC supply
        ERC20 LRC = ERC20(lrcAddress);
        uint totalSupply = LRC.totalSupply() - LRC.balanceOf(address(0x0));
        uint amount = totalSupply.mul(TIER_UPGRADE_COST_PERCENTAGE) / BURN_BASE_PERCENTAGE;
        require(
            lrcAddress.safeTransferFrom(
                msg.sender,
                address(0x0),
                amount
            ),
            BURN_FAILURE
        );

        // Upgrade tier
        TokenData storage tokenData = tokens[token];
        tokenData.validUntil = now.add(YEAR_TO_SECONDS);
        tokenData.tier = currentTier + 1;

        emit TokenTierUpgraded(token, tokenData.tier);

        return true;
    }

    function getTokenTier(
        address token
        )
        public
        view
        returns (uint tier)
    {
        TokenData storage tokenData = tokens[token];
        // Fall back to lowest tier
        tier = (now > tokenData.validUntil) ? TIER_2 : tokenData.tier;
    }

}
