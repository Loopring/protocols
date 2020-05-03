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
        uint   balance;        // Total amount of LRC staked or rewarded
        uint64 depositedAt;
        uint64 claimedAt;      // timestamp from which more points will be accumulated
    }

    Staking public total;
    mapping (address => Staking) public stakings;

    constructor(address _lrcAddress)
        Claimable()
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        lrcAddress = _lrcAddress;
    }

    function setProtocolFeeVault(address _protocolFeeVaultAddress)
        external
        override
        nonReentrant
        onlyOwner
    {
        // Allow zero-address
        protocolFeeVaultAddress = _protocolFeeVaultAddress;
        emit ProtocolFeeVaultChanged(protocolFeeVaultAddress);
    }

    function getTotalStaking()
        public
        override
        view
        returns (uint)
    {
        return total.balance;
    }

    function getUserStaking(address user)
        public
        override
        view
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint balance,
            uint pendingReward
        )
    {
        withdrawalWaitTime = getUserWithdrawalWaitTime(user);
        rewardWaitTime = getUserClaimWaitTime(user);
        balance = stakings[user].balance;
        (, , pendingReward) = getUserPendingReward(user);
    }

    function stake(uint amount)
        external
        override
        nonReentrant
    {
        require(amount > 0, "ZERO_VALUE");

        // Lets trandfer LRC first.
        lrcAddress.safeTransferFromAndVerify(msg.sender, address(this), amount);

        Staking storage user = stakings[msg.sender];

        if (user.balance == 0) {
            numAddresses += 1;
        }

        // update user staking
        uint balance = user.balance.add(amount);

        user.depositedAt = uint64(
            user.balance
                .mul(user.depositedAt)
                .add(amount.mul(now)) / balance
        );

        user.claimedAt = uint64(
            user.balance
                .mul(user.claimedAt)
                .add(amount.mul(now)) / balance
        );

        user.balance = balance;

        // update total staking
        balance = total.balance.add(amount);

        total.claimedAt = uint64(
            total.balance
                .mul(total.claimedAt)
                .add(amount.mul(now)) / balance
        );

        total.balance = balance;

        emit LRCStaked(msg.sender, amount);
    }

    function withdraw(uint amount)
        external
        override
        nonReentrant
    {
        require(getUserWithdrawalWaitTime(msg.sender) == 0, "NEED_TO_WAIT");

        // automatical claim when possible
        if (protocolFeeVaultAddress != address(0) &&
            getUserClaimWaitTime(msg.sender) == 0) {
            claimReward();
        }

        Staking storage user = stakings[msg.sender];

        uint _amount = (amount == 0 || amount > user.balance) ? user.balance : amount;
        require(_amount > 0, "ZERO_BALANCE");

        total.balance = total.balance.sub(_amount);
        user.balance = user.balance.sub(_amount);

        if (user.balance == 0) {
            numAddresses -= 1;
            delete stakings[msg.sender];
        }

        // transfer LRC to user
        lrcAddress.safeTransferAndVerify(msg.sender, _amount);

        emit LRCWithdrawn(msg.sender, _amount);
    }

    function claim()
        external
        override
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

        (totalPoints, userPoints, claimedAmount) = getUserPendingReward(msg.sender);

        if (claimedAmount > 0) {
            IProtocolFeeVault(protocolFeeVaultAddress).claimStakingReward(claimedAmount);

            total.balance = total.balance.add(claimedAmount);

            total.claimedAt = uint64(
                now.sub(totalPoints.sub(userPoints) / total.balance)
            );

            Staking storage user = stakings[msg.sender];
            user.balance = user.balance.add(claimedAmount);
            user.claimedAt = uint64(now);
        }
        emit LRCRewarded(msg.sender, claimedAmount);
    }

    function getUserWithdrawalWaitTime(address user)
        private
        view
        returns (uint)
    {
        uint depositedAt = stakings[user].depositedAt;
        if (depositedAt == 0) {
            return MIN_WITHDRAW_DELAY;
        } else {
            uint time = depositedAt + MIN_WITHDRAW_DELAY;
            return (time <= now) ? 0 : time.sub(now);
        }
    }

    function getUserClaimWaitTime(address user)
        private
        view
        returns (uint)
    {
        uint claimedAt = stakings[user].claimedAt;
        if (claimedAt == 0) {
            return MIN_CLAIM_DELAY;
        } else {
            uint time = stakings[user].claimedAt + MIN_CLAIM_DELAY;
            return (time <= now) ? 0 : time.sub(now);
        }
    }

    function getUserPendingReward(address user)
        private
        view
        returns (
            uint totalPoints,
            uint userPoints,
            uint pendingReward
        )
    {
        Staking storage staking = stakings[user];

        // We add 1 to the time to make totalPoints slightly bigger
        totalPoints = total.balance.mul(now.sub(total.claimedAt).add(1));
        userPoints = staking.balance.mul(now.sub(staking.claimedAt));

        // Because of the math calculation, this is possible.
        if (totalPoints < userPoints) {
            userPoints = totalPoints;
        }

        if (protocolFeeVaultAddress != address(0) &&
            totalPoints != 0 &&
            userPoints != 0) {
            (, , , , , , , pendingReward) = IProtocolFeeVault(
                protocolFeeVaultAddress
            ).getProtocolFeeStats();
            pendingReward = pendingReward.mul(userPoints) / totalPoints;
        }
    }
}
