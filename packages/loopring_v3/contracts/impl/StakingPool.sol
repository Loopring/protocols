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

    uint public constant MIN_CLAIM_DELAY      = 90 days;
    uint public constant MIN_WITHDRAW_DELAY   = 90 days;

    address public lrcAddress = address(0);

    struct Stake {
        address user;
        uint    stake;
        uint    depositedAt;
        uint    claimedAt; // timestamp from which more points will be accumulated
    }

    Stake global;
    mapping (address => Stake) users;

    function getUserWithdrawalWaitTime(address user)
        view
        public
        returns (uint minutes_)
    {
        if (users[user].depositedAt.add(MIN_WITHDRAW_DELAY) <= now) return 0;
        else return users[user].depositedAt.add(MIN_WITHDRAW_DELAY).sub(now);
    }

    function getUserClaimWaitTime(address user)
        view
        public
        returns (uint minutes_)
    {
       if (users[user].claimedAt.add(MIN_CLAIM_DELAY) <= now) return 0;
       else return users[user].claimedAt.add(MIN_CLAIM_DELAY).sub(now);
    }

    function getTotalReward()
        view
        public
        returns (uint)
    {
        return ERC20(lrcAddress).balanceOf(address(this)).sub(global.stake);
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

        user.stake = user.stake.add(amount);

        // update global stake the same way (create an internal function for this)
        global.depositedAt = global.stake.mul(global.depositedAt).add(amount.mul(now)) / global.stake.add(amount);

        if (global.claimedAt == 0) {
          global.claimedAt = global.depositedAt;
        } else {
          global.claimedAt = global.stake.mul(global.claimedAt).add(amount.mul(now)) / global.stake.add(amount);
        }

        global.stake = global.stake.add(amount);
    }

    function claimReward()
        public
        returns (uint claimed)
    {
        require(getUserClaimWaitTime(msg.sender) == 0);

        Stake storage user = users[msg.sender];

        uint globalPoints = global.stake.mul(now.sub(global.claimedAt));
        uint userPoints = user.stake.mul(now.sub(user.claimedAt));

        require(globalPoints > 0 && userPoints > 0);

        claimed = getTotalReward().mul(userPoints) / globalPoints;

        global.stake = global.stake.add(claimed);
        global.claimedAt = globalPoints.sub(userPoints) / global.stake;

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

        user.stake = user.stake.sub(amount);
        global.stake = global.stake.sub(amount);

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
}
