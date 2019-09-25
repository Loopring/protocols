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


contract ITokenSeller
{
    function sellToken(
        address tokenS,
        uint amountS,
        address tokenB
        )
        external
        returns (bool success);
}

/// @title IProtocolFeeVault
/// @dev This smart contract manages the distribution of protocol fees.
///     Tokens other than LRC will be auctioned off for LRC using Oedax. The owner
///     of this smart contract will also have the option to withdraw non-LRC tokens
///     and Ether to sell them for LRC by other means such as using a centralized
///     exchange. This option will be disabled once Oedax is production-ready.
///     For LRC token, 70% of them can be withdrawn to the UserStakingPool contract
///     to reward LRC stakers; 20% of them can be withdrawn to the Loopring DAO,
///     and the remaining 10% can be burned to reduce LRC's total supply.
contract IProtocolFeeVault
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

    event LRCWithdrawnToDAO(
        uint    amountDAO,
        uint    amountBurn
    );
    event TokenSold(
        address token,
        uint    amount
    );

    /// @dev Claims LRC as staking reward to the IUserStakingPool contract.
    ///      Note that this function can only be called by
    ///      the IUserStakingPool contract.
    ///
    /// @param amount The amount of LRC to be claimed.
    function claimStakingReward(uint amount) external;

    /// @dev Returns some global stats regarding fees.
    /// @return accumulatedFees The accumulated amount of LRC protocol fees.
    /// @return accumulatedDAOFund The accumulated amount of LRC to burn.
    /// @return accumulatedBurn The accumulated amount of LRC as developer pool.
    /// @return accumulatedReward The accumulated amount of LRC as staking reward.
    /// @return remainingFees The remaining amount of LRC protocol fees.
    /// @return remainingBurn The remaining amount of LRC to burn.
    /// @return remainingDAOFund The remaining amount of LRC as developer pool.
    /// @return remainingReward The remaining amount of LRC as staking reward.
    function getLRCFeeStats()
        public
        view
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

    /// @dev Sets token swapper address, only callable by the owner.
    /// @param _tokenSellerAddress The address of Oedax contract.
    function setTokenSeller(address _tokenSellerAddress) external;

    /// @dev Sets the Loopring DAO address, only callable by the owner.
    /// @param _daoAddress The address of the DAO contract.
    function setDAO(address _daoAddress) external;

    /// @dev Sells a non-LRC token or Ether to LRC, only callable by the owner.
    /// @param token The token or ether (0x0) to sell.
    /// @param amount THe amout of token/ether to sell.
    function sellTokenForLRC(
        address token,
        uint    amount
        )
        external;

    /// @dev Withdraws LRC to DAO and in the meanwhile burn some LRC according to
    ///      the predefined percentages.
    function withdrawLRCToDAO() external;
}
