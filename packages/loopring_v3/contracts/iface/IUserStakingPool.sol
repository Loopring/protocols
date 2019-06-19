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


/// @title IUserStakingPool
/// @dev This is the staking pool to hold LRC staked by end users.
///      70% of all protocol fees (in LRC) will be rewarded to users as staking reward;
///      10% of all protocol fees will be burned, and the rest 20% will be used as
///      developer fund.
///
///      WARNING: sending LRC directly to this contract will DONATE those LRC as protocol fees.
/// @author Daniel Wang - <daniel@loopring.org>
contract IUserStakingPool
{
    uint public constant MIN_CLAIM_DELAY        = 90 days;
    uint public constant MIN_WITHDRAW_DELAY     = 90 days;
    uint public constant AUCTION_DURATION       = 7  days;

    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant BURN_PERDENTAGE        = 10;

    address public lrcAddress       = address(0);
    address public oedaxAddress     = address(0);
    
    uint    public numAddresses         = 0;
    uint    public claimedBurn          = 0;
    uint    public claimedDev           = 0;

    bool    public allowOwnerWithdrawal = false;

    event LRCStaked(
        address  user,
        uint     amount
    );

    event LRCRewarded(
        address  user,
        uint     amount
    );

    event LRCWithdrawn(
        address  user,
        uint     amount
    );

    event LRCDrained(
        uint     burnAmount,
        uint     devAmount
    );

    event OwnerWithdrawal(
        address  token,
        uint     amount
    );

    event AuctionStarted(
        address tokenS,
        address auction
    );

    event OedaxAddressUpdated(
        address Oedax
    );

    /// @dev Returns global staking stats.
    /// @return totalStake The current amount of LRC staked by all users.
    /// @return accumulatedFees The accumulated LRC fees over time until now.
    /// @return accumulatedBurn The accumulated LRC fees burned over time until now.
    /// @return accumulatedReward The accumulated LRC fees claimed by users over time until now.
    /// @return accumulatedDev The accumulated LRC fees withdrawn by owner
    ///         as developer fund over time until now.
    /// @return remainingFees The LRC fees available as of now.
    /// @return remainingBurn The LRC fees available to burn as of now.
    /// @return remainingReward The LRC fees available to reward users as of now.
    /// @return remainingDev The LRC fees available for developer fund as of now.
    function getStakingStats()
        view
        public
        returns (
            uint totalStake,
            uint accumulatedFees,
            uint accumulatedBurn,
            uint accumulatedReward,
            uint accumulatedDev,
            uint remainingFees,
            uint remainingBurn,
            uint remainingReward,
            uint remainingDev
        );

    /// @dev Returns staking status for a user.
    /// @param user The user address
    /// @return withdrawalWaitTime Time in seconds that the user must wait until
    ///         he can withdraw staked LRC.
    /// @return claimWaitTime Time in seconds the user must wait until he can claim LRC reward.
    /// @return stakedAmount The amount of LRC this user staked.
    /// @return outstandingReward The amount of LRC reward the user can claim as of now.
    function getUserStakingPool(address user)
        view
        external
        returns (
            uint withdrawalWaitTime,
            uint claimWaitTime,
            uint stakedAmount,
            uint outstandingReward
        );

    /// @dev Deposit a certain amount of LRC to stake.
    /// @param amount The amount of LRC to stake.
    function deposit(uint amount)
        external;

    /// @dev Withdraw a certain amount of LRC.
    ///      To get all LRC back, a user needs to call `claim` then `withdraw`.
    /// @param amount The amount of LRC to stake.
    function withdraw(uint amount)
        external;

    /// @dev Claim all LRC reward and immediately stake them.
    function claim()
        public
        returns (uint claimed);

    /// @dev Owner calls this function to withdraw developer fund and burn LRC.
    ///        This function can only be called by the owner.
    function drainAndBurn()
        external
        // onlyOwner
        ;

    /// @dev Set a new Oedax address.
    /// @param _oedaxAddress THe new Oedax address.
    ///
    ///      This function can only be called by the owner.
    function setOedax(address _oedaxAddress)
        external
        // onlyOwner
        ;

    /// @dev Sell a token for LRC by starting a new auction.
    /// @param tokenS Tokens to sell. use 0x0 for Ether.
    /// @return auction The auction address.
    function auctionOffTokens(
        address tokenS,
        bool    sellForEther,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T
        )
        external
        // onlyOwner
        returns (
            address payable auction
        );

    /// @dev Settles an auction
    /// @param auction Auction address.
    function settleAuction(address auction)
        external
        // onlyOwner
        ;

    /// @dev Disable owner to withdrawl non-LRC tokens and Ether.
    //       This operation cannot be un-done.
    function permanentlyDisableOwnerWithdrawal()
        external
        // onlyOwner
        ;

    /// @dev Owner withdraw non-LRC tokens or Ether. This method will be disable
    ///      once `permanentlyDisableOwnerWithdrawal` is called after auction has been tested.
    /// @param token Tokens to withdraw, 0x0 for Ether.
    /// @param amount The amount of token/ether to withdraw.
    function ownerWithdraw(
        address token,
        uint    amount
        )
        external
        // onlyOwner
        ;
}
