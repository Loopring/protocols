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
pragma solidity ^0.6.6;


/// @title IProtocolFeeVault
/// @dev This smart contract manages the distribution of protocol fees.
///     Tokens other than LRC will be sold by TokenSeller,
///     If no TokenSeller is set, the tokens or Ether will be sent to the owner
///     to sell them for LRC by other means such as using a centralized exchange.
///     For LRC token, 70% of them can be withdrawn to the UserStakingPool contract
///     to reward LRC stakers; 20% of them can be withdrawn to the Loopring DAO,
///     and the remaining 10% can be burned to reduce LRC's total supply.
abstract contract IProtocolFeeVault
{
    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant DAO_PERDENTAGE         = 20;

    address public userStakingPoolAddress;
    address public lrcAddress;
    address public tokenSellerAddress;
    address public daoAddress;

    uint claimedReward;
    uint claimedDAOFund;
    uint claimedBurn;

    event LRCClaimed(uint amount);
    event DAOFunded(uint amountDAO, uint amountBurn);
    event TokenSold(address token, uint amount);
    event SettingsUpdated(uint time);

    /// @dev Sets depdending contract address. All these addresses can be zero.
    /// @param _userStakingPoolAddress The address of the user staking pool.
    /// @param _tokenSellerAddress The address of the token seller.
    /// @param _daoAddress The address of the DAO contract.
    function updateSettings(
        address _userStakingPoolAddress,
        address _tokenSellerAddress,
        address _daoAddress
        )
        external
        virtual;

    /// @dev Claims LRC as staking reward to the IUserStakingPool contract.
    ///      Note that this function can only be called by
    ///      the IUserStakingPool contract.
    ///
    /// @param amount The amount of LRC to be claimed.
    function claimStakingReward(uint amount)
        external
        virtual;

    /// @dev Withdraws LRC to DAO and in the meanwhile burn some LRC according to
    ///      the predefined percentages.
    function fundDAO()
        external
        virtual;

    /// @dev Sells a non-LRC token or Ether to LRC. If no TokenSeller is set,
    ///      the tokens or Ether will be sent to the owner.
    /// @param token The token or ether (0x0) to sell.
    /// @param amount THe amout of token/ether to sell.
    function sellTokenForLRC(
        address token,
        uint    amount
        )
        external
        virtual;

    /// @dev Returns some global stats regarding fees.
    /// @return accumulatedFees The accumulated amount of LRC protocol fees.
    /// @return accumulatedBurn The accumulated amount of LRC to burn.
    /// @return accumulatedDAOFund The accumulated amount of LRC as developer pool.
    /// @return accumulatedReward The accumulated amount of LRC as staking reward.
    /// @return remainingFees The remaining amount of LRC protocol fees.
    /// @return remainingBurn The remaining amount of LRC to burn.
    /// @return remainingDAOFund The remaining amount of LRC as developer pool.
    /// @return remainingReward The remaining amount of LRC as staking reward.
    function getProtocolFeeStats()
        public
        view
        virtual
        returns (
            uint accumulatedFees,
            uint accumulatedBurn,
            uint accumulatedDAOFund,
            uint accumulatedReward,
            uint remainingFees,
            uint remainingBurn,
            uint remainingDAOFund,
            uint remainingReward
        );
}
