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


/// @title ITokenRegistry
/// @author Brecht Devos - <brecht@loopring.org>
contract ITokenRegistry {

    uint16 public constant BASIC_POINT_BASE       = 10000; // 100%

    // Burn rates
    uint16 public constant BURNRATE_TIER1_BIPS    = 250;  // 2.5%
    uint16 public constant BURNRATE_TIER2_BIPS    = 1500; // 15%
    uint16 public constant BURNRATE_TIER3_BIPS    = 3000; // 30%
    uint16 public constant BURNRATE_TIER4_BIPS    = 5000; // 50%

    // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16 public constant TIER_UPGRADE_COST_BIPS = 10;   // 0.1%
    uint   public constant TIER_UPGRADE_DURATION  = 365 days;

    // Fee
    uint public constant TOKEN_REGISTRATION_FEE_IN_LRC_BASE   = 10000 ether;
    uint public constant TOKEN_REGISTRATION_FEE_IN_LRC_DELTA  = 1000 ether;

    // General
    uint public constant MAX_NUM_TOKENS = 2 ** 12; // 4096

    event TokenTierUpgraded(
        address indexed addr,
        uint            tier
    );

    function getTokenId(
        address tokenAddress
        )
        public
        view
        returns (uint16);

    function getTokenAddress(
        uint16 tokenId
        )
        external
        view
        returns (address);

    function getBurnRate(
        uint24 tokenId
        )
        public
        view
        returns (uint16 burnRate);

}
