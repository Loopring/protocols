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

import "../iface/IStakingPool.sol";

import "../lib/BurnableERC20.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";


/// @title An Implementation of IStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract StakingPool is IStakingPool, Claimable
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    struct Stake {
        address user;
        uint    stake;
        uint    depositedAt;
        uint    claimedAt; // timestamp from which more points will be accumulated
    }

    Stake private total;
    mapping (address => Stake) private users;

    constructor(
        address _lrcAddress,
        address _oedaxAddress
        )
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        require(_oedaxAddress != address(0), "ZERO_ADDRESS");

        owner = msg.sender;
        lrcAddress = _lrcAddress;
        oedaxAddress = _oedaxAddress;
    }

    function getTotalStaking()
        view
        external
        returns (
            uint stakedAmount,
            uint rewardAmount
        )
    {
        stakedAmount = getTotalStake();
        rewardAmount = getTotalReward();
    }

    function getUserStaking(address user)
        view
        external
        returns (
            uint withdrawalWaitTimeMinutes,
            uint claimWaitTimeMinutes,
            uint stakedAmount,
            uint rewardAmount
        )
    {
        withdrawalWaitTimeMinutes = getUserWithdrawalWaitTime(user);
        claimWaitTimeMinutes = getUserClaimWaitTime(user);
        stakedAmount = getUserStake(user);
        rewardAmount = getUserReward(user);
    }

    function deposit(uint amount)
        external
    {
        require(amount > 0);

        // Lets trandfer LRC first.
        require(
            lrcAddress.safeTransferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "TRANSFER_FAILURE"
        );

        Stake storage user = users[msg.sender];

        // Update the user's stake
        user.depositedAt = user.stake.mul(user.depositedAt).add(amount.mul(now)) / user.stake.add(amount);

        if (user.claimedAt == 0) {
          user.claimedAt = user.depositedAt;
        } else {
          user.claimedAt = user.stake.mul(user.claimedAt).add(amount.mul(now)) / user.stake.add(amount);
        }

        if (user.stake == 0) {
            numAddresses = numAddresses.add(1);
        }

        user.stake = user.stake.add(amount);

        // update total stake the same way (create an internal function for this)
        total.depositedAt = total.stake.mul(total.depositedAt).add(amount.mul(now)) / total.stake.add(amount);

        if (total.claimedAt == 0) {
          total.claimedAt = total.depositedAt;
        } else {
          total.claimedAt = total.stake.mul(total.claimedAt).add(amount.mul(now)) / total.stake.add(amount);
        }

        total.stake = total.stake.add(amount);
    }

    function claimReward()
        public
        returns (uint claimed)
    {
        require(getUserClaimWaitTime(msg.sender) == 0);

        Stake storage user = users[msg.sender];

        uint totalPoints = total.stake.mul(now.sub(total.claimedAt));
        uint userPoints = user.stake.mul(now.sub(user.claimedAt));

        require(totalPoints > 0 && userPoints > 0);

        claimed = getTotalReward().mul(userPoints) / totalPoints;

        total.stake = total.stake.add(claimed);
        total.claimedAt = totalPoints.sub(userPoints) / total.stake;

        user.stake = user.stake.add(claimed);
        user.claimedAt = now;
    }

    function withdraw(uint amount)
        external
    {
        claimReward();  // always claim reward first

        require(amount > 0);
        require(getUserWithdrawalWaitTime(msg.sender) == 0);

        Stake storage user = users[msg.sender];
        require(user.stake >= amount);

        total.stake = total.stake.sub(amount);
        user.stake = user.stake.sub(amount);

        if (user.stake == 0) {
            numAddresses = numAddresses.sub(1);
        }

        // transfer LRC to user
        require(
            lrcAddress.safeTransferFrom(
                address(this),
                msg.sender,
                amount
            ),
            "TRANSFER_FAILURE"
        );
    }

    // -- Private Function --

    function getTotalReward()
        view
        private
        returns (uint)
    {
        return ERC20(lrcAddress).balanceOf(address(this)).sub(total.stake);
    }

    function getTotalStake()
        view
        private
        returns (uint)
    {
        return total.stake;
    }

    function getUserWithdrawalWaitTime(address user)
        view
        private
        returns (uint minutes_)
    {
        if (users[user].depositedAt.add(MIN_WITHDRAW_DELAY) <= now) return 0;
        else return users[user].depositedAt.add(MIN_WITHDRAW_DELAY).sub(now);
    }

    function getUserClaimWaitTime(address user)
        view
        private
        returns (uint minutes_)
    {
       if (users[user].claimedAt.add(MIN_CLAIM_DELAY) <= now) return 0;
       else return users[user].claimedAt.add(MIN_CLAIM_DELAY).sub(now);
    }

    function getUserReward(address userAddress)
        view
        private
        returns (uint)
    {
        if (getUserClaimWaitTime(userAddress) != 0) {
            return 0;
        }

        Stake storage user = users[userAddress];

        uint totalPoints = total.stake.mul(now.sub(total.claimedAt));
        uint userPoints = user.stake.mul(now.sub(user.claimedAt));

        if (totalPoints == 0 || userPoints == 0) {
            return 0;
        }

        return getTotalReward().mul(userPoints) / totalPoints;
    }

    function getUserStake(address userAddress)
        view
        private
        returns (uint)
    {
        return users[userAddress].stake;
    }
}
