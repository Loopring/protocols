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
pragma solidity 0.5.11;


/// @title IProtocolFeeVault
/// @dev This smart contract manages the distribution of protocol fees.
///     Tokens other than LRC will be auctioned off for LRC using Oedax. The owner
///     of this smart contract will also have the option to withdraw non-LRC tokens
///     and Ether to sell them for LRC by other means such as using a centralized
///     exchange. This option will be disabled once Oedax is production ready.
///     For LRC token, 70% of them can be withdrawn to the UserStakingPool contract
///     to reward LRC stakers; 20% of them can be withdrawn to the Loopring DAO,
///     and the remaining 10% can be burned to reduce LRC's total supply.
contract IProtocolFeeVault
{
    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant DAO_PERDENTAGE         = 20;

    address public userStakingPoolAddress;
    address public lrcAddress;
    address public oedaxAddress;
    address public daoAddress;

    uint claimedReward;
    uint claimedDAOFund;
    uint claimedBurn;

    bool allowOwnerWithdrawal;

    event OwnerWithdrawal(
        address token,
        uint    amount
    );
    event LRCWithdrawnToDAO(
        uint    amountDAO,
        uint    amountBurn
    );
    event AuctionStarted(
        address tokenS,
        uint    amountS,
        address tokenB,
        address payable auctionAddr
    );

    /// @dev Claim LRC as staking reward to the IUserStakingPool contract.
    ///
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

    /// @dev Set Oedax address, only callable by the owner.
    /// @param _oedaxAddress The address of Oedax contract.
    function setOedax(address _oedaxAddress) external;

    /// @dev Set the Loopring DAO address, only callable by the owner.
    /// @param _daoAddress The address of the DAO contract.
    function setDAO(address _daoAddress) external;

    /// @dev Permanently disallow owner to withdraw non-LRC protocol fees, only callable by the owner.
    function disableOwnerWithdrawal() external;

    /// @dev Withdraw non-LRC protocol fees to owner's address, only callable by the owner.
    /// @param token The token to be withdrawn
    /// @param amount The amount of token to withdraw.
    function withdraw(
        address token,
        uint    amount
        )
        external;

    /// @dev Sell a non-LRC token or Ether to LRC, only callable by the owner.
    /// @param token The token or ether (0x0) to sell.
    /// @param amount THe amout of token/ether to sell.
    /// @param sellForEther True if tokenB should be Ether,false if tokenB is LRC.
    /// @param minAskAmount The minimum amount that can be used in an ask.
    /// @param minBidAmount The minimum amount that can be used in a bid.
    /// @param P Numerator part of the target price `p`.
    /// @param S Price precision -- (_P / 10**_S) is the float value of the target price.
    /// @param M Price factor. `p * M` is the maximum price and `p / M` is the minimum price.
    /// @param T The minimum auction duration in second, the maximam duration will be 2*T.
    /// @return auctionAddr Auction address.
    function auctionOffTokens(
        address token,
        uint    amount,
        bool    sellForEther,
        uint    minAskAmount,
        uint    minBidAmount,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T
        )
        external
        returns (
            address payable auctionAddr
        );

    /// @dev withdraw LRC to DAO and in the meanwhile burn some LRC according to
    ///      the predefined percentages.
    function withdrawLRCToDAO() external;

    /// @dev Settle a closed Oedax auction,
    function settleAuction(address auction) external;

}
