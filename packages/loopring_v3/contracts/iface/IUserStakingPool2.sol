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
contract IUserStakingPool2
{
    uint public constant MIN_CLAIM_DELAY        = 90 days;
    uint public constant MIN_WITHDRAW_DELAY     = 90 days;
    uint public constant AUCTION_DURATION       = 7  days;

    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant BURN_PERDENTAGE        = 10;

    address public lrcAddress       = address(0);
    address public pfmAddress     = address(0);
    
    uint    public numAddresses         = 0;

    event LRCStaked   (address user, uint amount);
    event LRCWithdrawn(address user, uint amount);
    event LRCRewarded (address user, uint amount);
}