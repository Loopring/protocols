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

contract IOedax {
    /// @dev Create a new auction
    ///      NOTE that this method should have the same signature as in:
    ///      https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IOedax.sol
    /// @param askToken The ask (base) token. Prices are in form of 'bids/asks'.
    /// @param bidToken The bid (quote) token. Bid-token must have a higher rank than ask-token.
    /// @param minAskAmount The minimum ask amount.
    /// @param minBidAmount The minimum bid amount.
    /// @param P Numerator part of the target price `p`.
    /// @param S Price precision -- (_P / 10**_S) is the float value of the target price.
    /// @param M Price factor. `p * M` is the maximum price and `p / M` is the minimum price.
    /// @param T1 The maximum auction duration in second.
    /// @param T2 The maximum auction duration in second.
    /// @return auctionAddr Auction address.
    function createAuction(
        address askToken,
        address bidToken,
        uint    minAskAmount,
        uint    minBidAmount,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T1,
        uint    T2
        )
        public
        payable
        returns (address payable auctionAddr);

    mapping (address => uint) public tokenRankMap;

    uint public creatorEtherStake;
}

contract IAuction {
    function settle() public;
    function ask(uint amount) external returns (uint accepted);
}

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
        uint    claimedReward;
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
        )
    {
        totalStake = total.stake;
        uint balance = ERC20(lrcAddress).balanceOf(address(this));

        accumulatedFees = balance.sub(total.stake)
            .add(claimedBurn)
            .add(claimedDev)
            .add(total.claimedReward);

        accumulatedBurn = accumulatedFees.mul(BURN_PERDENTAGE) / 100;
        remainingBurn = accumulatedBurn.sub(claimedBurn);

        accumulatedReward = accumulatedFees.mul(REWARD_PERCENTAGE) / 100;
        remainingReward = accumulatedReward.sub(total.claimedReward);

        accumulatedDev = accumulatedFees.sub(accumulatedBurn).sub(accumulatedReward);
        remainingDev = accumulatedDev.sub(claimedDev);

        remainingFees = remainingBurn.add(remainingReward).add(remainingDev);
    }

    function getUserStaking(address user)
        view
        external
        returns (
            uint withdrawalWaitTime,
            uint rewardWaitTime,
            uint stakeAmount,
            uint outstandingReward
        )
    {
        withdrawalWaitTime = userWithdrawalWaitTime(user);
        rewardWaitTime = userRewardWaitTime(user);
        stakeAmount = users[user].stake;
        outstandingReward = userOutstandingReward(user);
    }

    function deposit(uint amount)
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
        require(userWithdrawalWaitTime(msg.sender) == 0);

        Stake storage user = users[msg.sender];
        require(user.stake >= amount);

        uint _amount = amount == 0 ? user.stake : amount;

        total.stake = total.stake.sub(_amount);
        user.stake = user.stake.sub(_amount);

        if (user.stake == 0) {
            numAddresses = numAddresses.sub(1);
        }

        // transfer LRC to user
        require(
            lrcAddress.safeTransferFrom(address(this), msg.sender, _amount),
            "TRANSFER_FAILURE"
        );

        emit LRCWithdrawn(msg.sender, _amount);
    }

    function claimAndBurn()
        public
        returns (uint claimed)
    {
        require(userRewardWaitTime(msg.sender) == 0);

        Stake storage user = users[msg.sender];

        uint totalPoints = total.stake.mul(now.sub(total.claimedAt));
        uint userPoints = user.stake.mul(now.sub(user.claimedAt));

        assert(totalPoints > 0);

        uint remainingReward;
        (, , , , , , , remainingReward,) = getStakingStats();

        claimed = remainingReward.mul(userPoints) / totalPoints;

        total.stake = total.stake.add(claimed);
        total.claimedReward = total.claimedReward.add(claimed);
        total.claimedAt = totalPoints.sub(userPoints) / total.stake;

        user.stake = user.stake.add(claimed);
        user.claimedReward = user.claimedReward.add(claimed);
        user.claimedAt = now;

        emit LRCRewarded(msg.sender, claimed);
    }

    function drain(address recipient)
        external
        onlyOwner 
    {
        uint remainingBurn;
        uint remainingDev;
        (, , , , , , remainingBurn, , remainingDev) = getStakingStats();

        require(BurnableERC20(lrcAddress).burn(remainingBurn), "BURN_FAILURE");

        address target = recipient == address(0) ?  owner : recipient;
        require(
            lrcAddress.safeTransferFrom(address(this), target, remainingDev),
            "TRANSFER_FAILURE"
        );

        claimedBurn = claimedBurn.add(remainingBurn);
        claimedDev = claimedDev.add(remainingDev);

        emit LRCDrained(remainingBurn, remainingDev);
    }

    function setOedax(address _oedaxAddress)
        external
        onlyOwner
    {
        require(_oedaxAddress != oedaxAddress, "SAME_ADDRESS");
        oedaxAddress = _oedaxAddress;

        emit OedaxAddressUpdated(oedaxAddress);
    }

    function sellTokens(
        address tokenS,
        bool    sellForEther,
        uint64  P,
        uint64  S,
        uint8   M,
        uint    T
        )
        external
        onlyOwner
        returns (
            address payable auctionAddr
        )
    {
        require(oedaxAddress != address(0), "ZERO_ADDRESS");

        address tokenB = sellForEther ? address(0) : lrcAddress;
        require(tokenS != tokenB, "SAME_TOKEN");

        IOedax oedax = IOedax(oedaxAddress);
        uint ethStake = oedax.creatorEtherStake();

        auctionAddr = oedax.createAuction.value(ethStake)(
            tokenS,
            tokenB,
            0,
            0,
            P,
            S,
            M,
            T,
            T * 2
        );

        IAuction auction = IAuction(auctionAddr);

        auction.ask(124);

        emit AuctionStarted(
            tokenS,
            auctionAddr
        );
    }

    // -- Private Function --

    function userWithdrawalWaitTime(address user)
        view
        private
        returns (uint minutes_)
    {
        if (users[user].depositedAt.add(MIN_WITHDRAW_DELAY) <= now) return 0;
        else return users[user].depositedAt.add(MIN_WITHDRAW_DELAY).sub(now);
    }

    function userRewardWaitTime(address user)
        view
        private
        returns (uint minutes_)
    {
       if (users[user].claimedAt.add(MIN_CLAIM_DELAY) <= now) return 0;
       else return users[user].claimedAt.add(MIN_CLAIM_DELAY).sub(now);
    }

    function userOutstandingReward(address userAddress)
        view
        private
        returns (uint)
    {
        Stake storage user = users[userAddress];

        uint totalPoints = total.stake.mul(now.sub(total.claimedAt));
        uint userPoints = user.stake.mul(now.sub(user.claimedAt));

        if (totalPoints == 0 || userPoints == 0) {
            return 0;
        }

        uint remainingReward;
        (, , , , , , , remainingReward,) = getStakingStats();
        return remainingReward.mul(userPoints) / totalPoints;
    }
}
