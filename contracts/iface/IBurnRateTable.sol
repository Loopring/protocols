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
/// @title IBurnRateTable - A contract for managing burn rates for tokens
contract IBurnRateTable {

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

    uint16 public constant BURN_BASE_PERCENTAGE           =                 100 * 10; // 100%

    // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16 public constant TIER_UPGRADE_COST_PERCENTAGE   =                        5; // 0.5%

    // Burn rates
    // Matching
    uint16 public constant BURN_MATCHING_TIER1            =                   5 * 10; //   5%
    uint16 public constant BURN_MATCHING_TIER2            =                  20 * 10; //  20%
    uint16 public constant BURN_MATCHING_TIER3            =                  40 * 10; //  40%
    uint16 public constant BURN_MATCHING_TIER4            =                  60 * 10; //  60%
    // P2P
    uint16 public constant BURN_P2P_TIER1                 =                        5; // 0.5%
    uint16 public constant BURN_P2P_TIER2                 =                   2 * 10; //   2%
    uint16 public constant BURN_P2P_TIER3                 =                   3 * 10; //   3%
    uint16 public constant BURN_P2P_TIER4                 =                   6 * 10; //   6%

    // Locking
    uint32 public constant LOCK_BASE_PERCENTAGE           =               100 * 1000; // 100%
    uint32 public constant MAX_LOCK_PERCENTAGE            =                       10;

    uint public constant LOCK_TIME                    =    1 * YEAR_TO_SECONDS;
    uint public constant LINEAR_UNLOCK_START_TIME     =    YEAR_TO_SECONDS / 2;


    event TokenTierUpgraded(
        address indexed addr,
        uint            tier
    );

    /// @dev   Returns the P2P and matching burn rate for the token.
    /// @param token The token to get the burn rate for.
    /// @return The burn rate. The P2P burn rate and matching burn rate
    ///         are packed together in the lowest 4 bytes.
    ///         (2 bytes P2P, 2 bytes matching)
    function getBurnRate(
        address token
        )
        external
        view
        returns (uint32 burnRate);

    /// @dev   Returns the tier of a token.
    /// @param token The token to get the token tier for.
    /// @return The tier of the token
    function getTokenTier(
        address token
        )
        public
        view
        returns (uint);

    /// @dev   Upgrades the tier of a token. Before calling this function,
    ///        msg.sender needs to approve this contract for the neccessary funds.
    /// @param token The token to upgrade the tier for.
    /// @return True if successful, false otherwise.
    function upgradeTokenTier(
        address token
        )
        external
        returns (bool);

    /// @dev   Gets the rebate rate of an order owner
    /// @param user The order owner
    /// @return The rebate rate
    function getRebateRate(
        address user
        )
        public
        view
        returns (uint16);

    /// @dev   Locks LRC from msg.sender to lower the burn rate on the fees he pays.
    ///        msg.sender needs to approve this contract for the neccessary funds.
    /// @param amount The amount of LRC to lock.
    /// @return True if successful, false otherwise.
    function lock(
        uint amount
        )
        external
        returns (bool);

    /// @dev   Withdraws LRC that was previously locked to lower the burn rate.
    /// @param amount The amount of LRC to withdraw.
    /// @return True if successful, false otherwise.
    function withdraw(
        uint amount
        )
        external
        returns (bool);

    /// @dev   Gets the total amount of LRC that is or was locked for a user
    /// @param user The user to get the balance for
    /// @return The total balance available in this contract
    function getBalance(
        address user
        )
        external
        view
        returns (uint);

    /// @dev   Gets the withdrawable amount of LRC from this contract
    /// @param user The user to get the withdrawable balance for
    /// @return The amount of LRC the user can withdraw
    function getWithdrawableBalance(
        address user
        )
        public
        view
        returns (uint);

    /// @dev   Gets the time the user started locking the LRC in this contract
    /// @param user The user to get the lock start time for
    /// @return The lock start time for the given user
    function getLockStartTime(
        address user
        )
        external
        view
        returns (uint);

}
