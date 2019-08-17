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

import "../lib/Claimable.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/IProtocolFeeVault.sol";
import "../iface/IUserStakingPool.sol";


/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract UserStakingPool is Claimable, ReentrancyGuard, IUserStakingPool
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    struct Staking {
        uint    balance;        // Total amount of LRC staked or rewarded
        uint    depositedAt;
        uint    claimedAt;      // timestamp from which more points will be accumulated
        uint    claimedReward;  // Total amount of LRC claimed as reward.
    }

    Staking private total;
    mapping (address => Staking) private stakings;

    constructor(address _lrcAddress)
        Ownable()
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
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
        return total.balance;
    }

    function getUserStaking(address user)
        external
        view
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint balance,
            uint claimableReward
        )
    {
        withdrawalWaitTime = getUserWithdrawalWaitTime(user);
        rewardWaitTime = getUserClaimWaitTime(user);
        balance = stakings[user].balance;
        (, , claimableReward) = getUserClaimableReward(user);
    }

    function stake(uint amount)
        external
        nonReentrant
    {
        require(amount > 0, "ZERO_VALUE");

        // Lets trandfer LRC first.
        require(
            lrcAddress.safeTransferFrom(msg.sender, address(this), amount),
            "TRANSFER_FAILURE"
        );

        Staking storage user = stakings[msg.sender];

        if (user.balance == 0) {
            numAddresses += 1;
        }

        updateStaking(user, amount);
        updateStaking(total, amount);

        emit LRCStaked(msg.sender, amount);
    }

    function withdraw(uint amount)
        external
        nonReentrant
    {
        require(getUserWithdrawalWaitTime(msg.sender) == 0, "NEED_TO_WAIT");

        // automatical claim when possible
        if (protocolFeeVaultAddress != address(0) &&
            getUserClaimWaitTime(msg.sender) == 0) {
            claimReward();
        }

        Staking storage user = stakings[msg.sender];
        require(user.balance >= amount, "INSUFFICIENT_FUND");

        uint _amount = (amount == 0) ? user.balance : amount;
        require(_amount > 0, "ZERO_VALUE");

        total.balance = total.balance.sub(_amount);
        user.balance = user.balance.sub(_amount);

        if (user.balance == 0) {
            numAddresses -= 1;
            delete stakings[msg.sender];
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
        nonReentrant
        returns (uint claimedAmount)
    {
        return claimReward();
    }

    // -- Private Function --

    function claimReward()
        private
        returns (uint claimedAmount)
    {
        require(protocolFeeVaultAddress != address(0), "ZERO_ADDRESS");
        require(getUserClaimWaitTime(msg.sender) == 0, "NEED_TO_WAIT");

        uint totalPoints;
        uint userPoints;

        (totalPoints, userPoints, claimedAmount) = getUserClaimableReward(msg.sender);
        if (claimedAmount > 0) {

            IProtocolFeeVault(protocolFeeVaultAddress).claimStakingReward(claimedAmount);

            total.balance = total.balance.add(claimedAmount);
            total.claimedReward = total.claimedReward.add(claimedAmount);
            total.claimedAt = (totalPoints >= userPoints) ?
            now.sub(totalPoints.sub(userPoints) / total.balance) : now;

            Staking storage user = stakings[msg.sender];
            user.balance = user.balance.add(claimedAmount);
            user.claimedReward = user.claimedReward.add(claimedAmount);
            user.claimedAt = now;
        }

        emit LRCRewarded(msg.sender, claimedAmount);
    }

    function updateStaking(
        Staking storage staking,
        uint  additionalBalance
        )
        private
    {
        uint balance = staking.balance.add(additionalBalance);

        staking.depositedAt = staking.balance
            .mul(staking.depositedAt)
            .add(additionalBalance.mul(now)) / balance;

        staking.claimedAt = (staking.claimedAt == 0) ?
            staking.depositedAt :
            staking.balance
                .mul(staking.claimedAt)
                .add(additionalBalance.mul(now)) / balance;

        staking.balance = balance;
    }

    function getUserWithdrawalWaitTime(address user)
        private
        view
        returns (uint)
    {
        uint time = stakings[user].depositedAt.add(MIN_WITHDRAW_DELAY);
        return (time <= now) ? 0 : time.sub(now);
    }

    function getUserClaimWaitTime(address user)
        private
        view
        returns (uint)
    {
        uint time = stakings[user].claimedAt.add(MIN_CLAIM_DELAY);
        return (time <= now) ? 0 : time.sub(now);
    }

    function getUserClaimableReward(address user)
        private
        view
        returns (
            uint totalPoints,
            uint userPoints,
            uint claimableReward
        )
    {
        Staking storage staking = stakings[user];

        totalPoints = total.balance.mul(now.sub(total.claimedAt));
        userPoints = staking.balance.mul(now.sub(staking.claimedAt));

        if (totalPoints != 0 && userPoints != 0) {
            (, , , , , , , claimableReward) = IProtocolFeeVault(protocolFeeVaultAddress).getLRCFeeStats();
            claimableReward = claimableReward.mul(userPoints) / totalPoints;
        }
    }
}
