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
        uint    tier;
        uint    validUntil;
    }

    struct UserData {
        uint    amount;
        uint    lockedSince;
        uint    amountWithdrawn;
    }

    mapping(address => TokenData) public tokens;
    mapping(address => UserData) public balances;

    uint public constant YEAR_TO_SECONDS = 31556952;

    // Tiers
    uint8 public constant TIER_4 = 0;
    uint8 public constant TIER_3 = 1;
    uint8 public constant TIER_2 = 2;
    uint8 public constant TIER_1 = 3;

    uint16 public constant TAX_BASE_PERCENTAGE            =                 100 * 10; // 100%

    // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16 public constant TIER_UPGRADE_COST_PERCENTAGE   =                        5; // 0.5%

    // Tax rates
    // Matching
    uint16 public constant TAX_MATCHING_TIER1             =                   5 * 10; //   5%
    uint16 public constant TAX_MATCHING_TIER2             =                  20 * 10; //  20%
    uint16 public constant TAX_MATCHING_TIER3             =                  40 * 10; //  40%
    uint16 public constant TAX_MATCHING_TIER4             =                  60 * 10; //  60%
    // P2P
    uint16 public constant TAX_P2P_TIER1                  =                        5; // 0.5%
    uint16 public constant TAX_P2P_TIER2                  =                   2 * 10; //   2%
    uint16 public constant TAX_P2P_TIER3                  =                   3 * 10; //   3%
    uint16 public constant TAX_P2P_TIER4                  =                   6 * 10; //   6%

    // Locking
    uint32 public constant LOCK_BASE_PERCENTAGE           =               100 * 1000; // 100%
    uint32 public constant MAX_LOCK_PERCENTAGE            =                       10;

    uint public constant LOCK_TIME                    =    1 * YEAR_TO_SECONDS;
    uint public constant LINEAR_UNLOCK_START_TIME     =    YEAR_TO_SECONDS / 2;


    event TokenTierUpgraded(
        address indexed addr,
        uint            tier
    );

    function getBurnAndRebateRate(
        address spender,
        address token,
        bool P2P
        )
        external
        view
        returns (uint16, uint16);

    function getTokenTier(
        address token
        )
        public
        view
        returns (uint);

    // Before calling this function, msg.sender needs to approve this contract for the neccessary funds
    function upgradeTokenTier(
        address token
        )
        external
        returns (bool);


    function getRebateRate(
        address user
        )
        public
        view
        returns (uint16);

    // Before calling this function, msg.sender needs to approve this contract for the neccessary funds
    function lock(
        uint amount
        )
        external
        returns (bool);

    function withdraw(
        uint amount
        )
        external
        returns (bool);

    function getBalance(
        address user
        )
        external
        view
        returns (uint);

    function getWithdrawableBalance(
        address user
        )
        public
        view
        returns (uint);

    function getLockStartTime(
        address user
        )
        external
        view
        returns (uint);

}
