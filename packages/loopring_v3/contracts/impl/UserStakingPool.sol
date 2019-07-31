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

import "../iface/IUserStakingPool.sol";
import "../iface/IProtocolFeeVault.sol";

import "..//lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";


/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract UserStakingPool is IUserStakingPool, Claimable
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    struct Stake {
        address user;
        uint    stake;
        uint    depositedAt;
        uint    claimedAt; // timestamp from which more points will be accumulated
        uint    claimedReward;
    }

    Stake private total;
    mapping (address => Stake) private users;

    constructor(
        address _lrcAddress
        )
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");

        owner = msg.sender;

        lrcAddress = _lrcAddress;
    }

    function setProtocolFeeVault(address _protocolFeeVaultAddress)
        external
        onlyOwner
    {
        require(_protocolFeeVaultAddress != address(0), "ZERO_ADDRESS");
        protocolFeeVaultAddress = _protocolFeeVaultAddress;
    }

    function getTotalStaking()
        external
        view
        returns (uint)
    {
        return total.stake;
    }

    function getUserStaking(address user)
        external
        view
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint stakeAmount,
            uint claimableReward
        )
    {
        withdrawalWaitTime = userWithdrawalWaitTime(user);
        rewardWaitTime = userClaimWaitTime(user);
        stakeAmount = users[user].stake;
        (, , claimableReward) = userOutstandingReward(user);
    }

    function stake(uint amount)
        external
    {
        require(amount > 0, "ZERO_VALUE");

        // Lets trandfer LRC first.
        require(
            lrcAddress.safeTransferFrom(msg.sender, address(this), amount),
            "TRANSFER_FAILURE"
        );

        Stake storage user = users[msg.sender];

        // Update the user's stake
        user.depositedAt = user.stake
            .mul(user.depositedAt)
            .add(amount.mul(now)) / user.stake.add(amount);

        if (user.claimedAt == 0) {
            user.claimedAt = user.depositedAt;
        } else {
            user.claimedAt = user.stake
                .mul(user.claimedAt)
                .add(amount.mul(now)) / user.stake.add(amount);
        }

        if (user.stake == 0) {
            numAddresses = numAddresses.add(1);
        }

        user.stake = user.stake.add(amount);

        // update total stake the same way (create an internal function for this)
        total.depositedAt = total.stake
            .mul(total.depositedAt)
            .add(amount.mul(now)) / total.stake.add(amount);

        if (total.claimedAt == 0) {
            total.claimedAt = total.depositedAt;
        } else {
            total.claimedAt = total.stake
                .mul(total.claimedAt)
                .add(amount.mul(now)) / total.stake.add(amount);
        }

        total.stake = total.stake.add(amount);

        emit LRCStaked(msg.sender, amount);
    }

    function withdraw(uint amount)
        external
    {
        require(userWithdrawalWaitTime(msg.sender) == 0, "NEED_TO_WAIT");

        Stake storage user = users[msg.sender];
        require(user.stake >= amount, "INSUFFICIENT_FUND");

        uint _amount = amount == 0 ? user.stake : amount;

        total.stake = total.stake.sub(_amount);
        user.stake = user.stake.sub(_amount);

        if (user.stake == 0) {
            numAddresses = numAddresses.sub(1);
        }

        // transfer LRC to user
        require(
            lrcAddress.safeTransfer(msg.sender, _amount),
            "TRANSFER_FAILURE"
        );

        emit LRCWithdrawn(msg.sender, _amount);
    }

    function claim()
        external
        returns (uint claimedAmount)
    {
        require(userClaimWaitTime(msg.sender) == 0, "NEED_TO_WAIT");
        require(protocolFeeVaultAddress != address(0), "ZERO_ADDRESS");

        uint totalPoints;
        uint userPoints;

        (totalPoints, userPoints, claimedAmount) = userOutstandingReward(msg.sender);

        IProtocolFeeVault(protocolFeeVaultAddress).claim(claimedAmount);

        total.stake = total.stake.add(claimedAmount);
        total.claimedReward = total.claimedReward.add(claimedAmount);
        if (totalPoints >= userPoints) {
            total.claimedAt = now.sub(totalPoints.sub(userPoints)/total.stake);
        } else {
            total.claimedAt = now;
        }

        Stake storage user = users[msg.sender];
        user.stake = user.stake.add(claimedAmount);
        user.claimedReward = user.claimedReward.add(claimedAmount);
        user.claimedAt = now;

        emit LRCRewarded(msg.sender, claimedAmount);
    }

    // -- Private Function --

    function userWithdrawalWaitTime(address user)
        private
        view
        returns (uint _seconds)
    {
        if (users[user].depositedAt.add(MIN_WITHDRAW_DELAY) <= now) return 0;
        else return users[user].depositedAt.add(MIN_WITHDRAW_DELAY).sub(now);
    }

    function userClaimWaitTime(address user)
        private
        view
        returns (uint minutes_)
    {
        if (users[user].claimedAt.add(MIN_CLAIM_DELAY) <= now) return 0;
        else return users[user].claimedAt.add(MIN_CLAIM_DELAY).sub(now);
    }

    function userOutstandingReward(address userAddress)
        private
        view
        returns (
            uint totalPoints,
            uint userPoints,
            uint outstandindReward
        )
    {
        Stake storage user = users[userAddress];

        totalPoints = total.stake.mul(now.sub(total.claimedAt));
        userPoints = user.stake.mul(now.sub(user.claimedAt));

        if (totalPoints != 0 && userPoints != 0) {
            (, , , , , , , outstandindReward) = IProtocolFeeVault(protocolFeeVaultAddress).getLRCFeeStats();
            outstandindReward = outstandindReward.mul(userPoints) / totalPoints;
        }
    }
}
