# LRC Staking

In Loopring 3.0's codebase, we implemented LRC staking (in UserStakingPool.sol). In this document, we highlight some of the design decisions.

## 3 Types of Staking


### 1. Exchange Staking

An exchange stakes LRC. Anyone can add to the stake of an exchange by calling `depositExchangeStake`, withdrawing the stake however is only allowed when the exchange is completely shutdown.

The stake ensures that the exchange behaves correctly. This is done by

- burning a part of the stake if a block isn't proven in time
- using a part of the stake to ensure the operator automatically distributes the withdrawals of users
- only allows the stake to be withdrawn when the exchange is shut down by automatically returning the funds of all its users

Exchanges with a large stake have a lot to lose by not playing by the rules and have nothing to gain because the operator/owner can never steal funds for itself.

### 2. Protocol Fee Staking

The exchange owner can stake LRC to lower the protocol fee. Anyone can add to the stake of an exchange by calling `depositProtocolFeeStake`, withdrawing the stake can be done at any time using `withdrawProtocolFeeStake`.

Note that the amount staked this way only counts for 50% to reduce the protocol fees because of the extra flexibility compared to the exchange stake. The surplus amount of LRC staked in exchange staking (i.e. everthing above the minimum amount required to commit new blocks) is counted for the complete 100%. This is to incentivize exchange staking which gives more guarantees to users.

### 3. User Staking

Users who stake LRC can get LRC reward proportional to his/her accumulated "points". 

#### Reward

The reward comes from Loopring's protocol fee. This fee is proportionally applied on every token transfer part of the trade. Lets look at one example:

> If the trade is between 10000 LRC and 2 ETH, and the protocol fee for both taker and maker is 0.05%. Then the two traders will end up paying 5LRC and 0.001ETH.

All non-LRC protocol fee can be converted to LRC via uniswap by anyone who is willing to pay the Etghereun transaction fee. 70% of all LRC protocol fee is available to be claimed as the user staking reward.

#### Points

Each user's points at time *t* is calculated as: `points = amount_staked * (t - staking_timestamp)`

If the user staked multiple times, his/her points will be the sum of points for each of his/her  staking. The total points are the sum of all user's points.

Note that 1) the `staking_timestamp` will be averaged out if the user staked multiple times. It is not the `staking_timestamp` of the user's first staking. 2) Each user's accumulated points and the total points are functions of the current timestamp and are always dynamic.


#### Restrictions
There is no lower or upper bound for the amount of LRC that can be staked per user or in total. But there are the following time-related restrictions:

1. A user can claim his LRC reward at most once per 90 days. The claimed LRC reward will be automatically staked (so his/her `staking_timestamp` will change)
2. A user can withdraw his LRC 90 days after his `staking_timestamp`. Withdrawals will not change `staking_timestamp`.

