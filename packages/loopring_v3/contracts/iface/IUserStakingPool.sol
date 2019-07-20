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
/// @dev This contract manages staked LRC tokens and their rewards.
///      WARNING: sending tokens directly to this contract will result in all
///      tokens to be lost.
/// @author Daniel Wang - <daniel@loopring.org>
contract IUserStakingPool
{
    uint public constant MIN_CLAIM_DELAY        = 90 days;
    uint public constant MIN_WITHDRAW_DELAY     = 90 days;
    uint public constant AUCTION_DURATION       = 7  days;

    address public lrcAddress;
    address public protocolFeeVaultAddress;

    uint    public numAddresses;

    event LRCStaked       (address user,  uint amount);
    event LRCWithdrawn    (address user,  uint amount);
    event LRCRewarded     (address user,  uint amount);

    /// @dev Set a new IProtocolFeeVault address, only callable by the owner.
    /// @param _protocolFeeVaultAddress The new IProtocolFeeVault address.
    function setProtocolFeeVault(address _protocolFeeVaultAddress)
        external;

    /// @dev Return the total number of LRC staked.
    function getTotalStaking()
        external
        view
        returns (uint);

    /// @dev Return information related to a specific user.
    /// @param user The user address.
    /// @return withdrawalWaitTime Time in seconds that the user has to wait before any LRC can be withdrawn.
    /// @return rewardWaitTime Time in seconds that the user has to wait before any LRC reward can be claimed.
    /// @return stakeAmount The amount of LRC staked.
    /// @return claimableReward The amount of LRC reward waiting to be claimed.
    function getUserStaking(address user)
        external
        view
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint stakeAmount,
            uint claimableReward
        );

    /// @dev Users call this function stake certain amount of LRC.
    ///      Note that transfering LRC directly to this contract will lost those LRC!!!
    /// @param amount The amount of LRC to stake.
    function stake(uint amount)
        external;

    /// @dev Users call this funciton to withdraw staked LRC.
    /// @param amount The amount of LRC to withdraw.
    function withdraw(uint amount)
        external;

    /// @dev Users call this funciton to claim all his/her LRC reward. The claimed LRC
    ///      will be staked again automatically.
    /// @param claimedAmount The amount of LRC claimed.
    function claim()
        external
        returns (uint claimedAmount);
}
