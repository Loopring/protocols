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

    constructor(address _lrcAddress, address _wethAddress) public {
        require(_lrcAddress != 0x0, "LRC address needs to be valid");
        require(_wethAddress != 0x0, "WETH address needs to be valid");
        lrcAddress = _lrcAddress;
        wethAddress = _wethAddress;
    }

    function getTaxRate(address token, bool P2P)
        external
        returns (uint16)
    {
        TokenData storage tokenData = tokens[token];
        uint tier = tokenData.tier;
        if(tokenData.sinceTimeStamp > block.timestamp + 2 * YEAR_TO_SECONDS) {
            // Fall back to lowest tier
            tier = TIER_4;
        }

        if (tier == TIER_1) {
            return (P2P ? TAX_P2P_INCOME_TIER1 : TAX_MATCHING_INCOME_TIER1);
        } else if (tokenData.tier == TIER_2) {
            return (P2P ? TAX_P2P_INCOME_TIER2 : TAX_MATCHING_INCOME_TIER2);
        } else if (tokenData.tier == TIER_3) {
            return (P2P ? TAX_P2P_INCOME_TIER3 : TAX_MATCHING_INCOME_TIER3);
        } else {
            return (P2P ? TAX_P2P_INCOME_TIER4 : TAX_MATCHING_INCOME_TIER4);
        }
    }

    function upgradeTier(address token)
        external
        returns (bool)
    {
        TokenData storage tokenData = tokens[token];

        // Can't upgrade more
        if (tokenData.tier == TIER_1) {
            return false;
        }

        // Burn 0.5% of total LRC supply
        uint amount = 1;
        bool success = BurnableERC20(lrcAddress).burnFrom(msg.sender, amount);
        require(success, "Burn needs to succeed");

        // Upgrade tier
        tokenData.token = token;
        tokenData.sinceTimeStamp = block.timestamp;
        tokenData.tier++;

        return true;
    }

}
