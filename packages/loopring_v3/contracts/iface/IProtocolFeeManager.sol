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


/// @title IProtocolFeeManager
contract IProtocolFeeManager
{
    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant DEVPOOL_PERDENTAGE     = 10;

    address public userStakingPoolAddress;
    address public lrcAddress;
    address public oedaxAddress;

    uint claimedReward;
    uint claimedDev;
    uint claimedBurn;

    bool allowOwnerWithdrawal;

    event OwnerWithdrawal(address token, uint amount);
    event LRCDrained(uint burnedAmount, uint devAmount);
    event AuctionStarted(address tokenS, address tokenB, address payable auctionAddr);

    /// @dev Claim LRC as staking reward to the IUserStakingPool contract.
    ///
    ///      Note that this function can only be called by
    ///      the IUserStakingPool contract.
    ///
    /// @param amount The amount of LRC to be claimed.
    function claim(uint amount ) external;

    /// @dev Returns some global stats regarding fees.
    /// @return accumulatedFees The accumulated amount of LRC protocol fees.
    /// @return accumulatedDev The accumulated amount of LRC to burn.
    /// @return accumulatedBurn The accumulated amount of LRC as developer pool.
    /// @return accumulatedReward The accumulated amount of LRC as staking reward.
    /// @return remainingFees The remaining amount of LRC protocol fees.
    /// @return remainingBurn The remaining amount of LRC to burn.
    /// @return remainingDev The remaining amount of LRC as developer pool.
    /// @return remainingReward The remaining amount of LRC as staking reward.
    function getLRCFeeStats()
        public
        view
        returns (
            uint accumulatedFees,
            uint accumulatedBurn,
            uint accumulatedDev,
            uint accumulatedReward,
            uint remainingFees,
            uint remainingBurn,
            uint remainingDev,
            uint remainingReward
        );

    /// @dev Set Oedax address, only callable by the owner.
    /// @param _oedaxAddress The address of Oedax contract.
    function setOedax(address _oedaxAddress) external;

    /// @dev Permanently disallow owner to withdraw non-LRC protocol fees, only callable by the owner.
    function disableOwnerWithdrawal() external;

    /// @dev Withdraw non-LRC protocol fees to owner's address, only callable by the owner.
    /// @param token The token to be withdrawn
    /// @param amount The amount of token to withdraw.
    function withdraw(
        address token,
        uint    amount
        )
        external
        ;

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

    /// @dev withdraw LRC for developer pool and burn a predefined amount of LRC,
    ///      only callable by the owner.
    function withdrawDevPoolAndBurn() external;

    /// @dev Settle a closed Oedax auction,
    function settleAuction(address auction) external;

}
