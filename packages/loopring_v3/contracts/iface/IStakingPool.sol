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


/// @title IStakingPool
/// @author Daniel Wang - <daniel@loopring.org>
contract IStakingPool
{
    uint public constant MIN_CLAIM_DELAY        = 90 days;
    uint public constant MIN_WITHDRAW_DELAY     = 90 days;
    uint public constant AUCTION_DURATION       = 15 days;

    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant BURN_PERDENTAGE        = 10;

    address public lrcAddress   = address(0);
    address public auctionerAddress = address(0);
    
    uint    public numAddresses         = 0;
    uint    public claimedBurn          = 0;
    uint    public claimedDev           = 0;

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

    event AuctionStarted(
        address tokenS,
        uint    amountS,
        uint    expectedLRCAmount,
        address auction
    );

    function getTotalStaking()
        view
        external
        returns (
            uint stakedAmount,
            uint rewardAmountClaimable,
            uint amountBurnable
        );
    function getUserStaking(address user)
        view
        external
        returns (
            uint withdrawalWaitTime,
            uint claimWaitTime,
            uint stakedAmount,
            uint claimableAmount
        );

    function deposit(uint amount) external;

    function withdraw(uint amount) external;

    function claim() public returns (uint claimed);

    function setAuctioner(address auctioner) external;

    function startAuction(
        address tokenS,
        address expectedLRCAmount
        )
        external
        returns (
            address auction
        );
}
