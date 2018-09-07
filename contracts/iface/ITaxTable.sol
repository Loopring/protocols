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

/// @author Brecht Devos - <brecht@loopring.org>
/// @title ITaxTable - A contract for managing tax rates for tokens
contract ITaxTable {

    struct TokenData {
        address token;
        uint tier;
        uint sinceTimeStamp;
    }

    mapping(address => TokenData) public tokens;

    // Tiers
    uint8 public constant TIER_4 = 0;
    uint8 public constant TIER_3 = 1;
    uint8 public constant TIER_2 = 2;
    uint8 public constant TIER_1 = 3;

    // Tax rates
    // Matching
    uint16 public constant TAX_MATCHING_INCOME_TIER1      =    10;
    uint16 public constant TAX_MATCHING_INCOME_TIER2      =   200;
    uint16 public constant TAX_MATCHING_INCOME_TIER3      =   400;
    uint16 public constant TAX_MATCHING_INCOME_TIER4      =   600;
    // P2P
    uint16 public constant TAX_P2P_INCOME_TIER1           =    10;
    uint16 public constant TAX_P2P_INCOME_TIER2           =    20;
    uint16 public constant TAX_P2P_INCOME_TIER3           =    30;
    uint16 public constant TAX_P2P_INCOME_TIER4           =    60;


    function getTaxRate(address token, bool P2P)
        external
        returns (uint16);

    function upgradeTier(address token)
        external
        returns (bool);

}
