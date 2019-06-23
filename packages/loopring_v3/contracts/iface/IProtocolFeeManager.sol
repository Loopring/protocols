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


/// @title IProtocolFeeManager
contract IProtocolFeeManager
{
    uint public constant REWARD_PERCENTAGE      = 70;
    uint public constant DEVPOOL_PERDENTAGE        = 10;
    
    address public userStakingPoolAddress;
    address public lrcAddress;
    address public oedaxAddress;

    uint claimedReward;
    uint claimedDev;
    uint claimedBurn;

    bool allowOwnerWithdrawal;

    event OwnerWithdrawal(address token, uint amount);
    event LRCDrained(uint burnedAmount, uint devAmount);

    function claim(
        uint    amount
        )
        external
        // onlyUserStakingPool
        ;

    function getLRCFeeStats()
        public
        view
        returns (
            uint accumulatedFees,
            uint accumulatedBurn,
            uint accumulatedDev,
            uint accumulatedReward,
            uint remainingFees,
            uint remainingBurn,
            uint remainingDev,
            uint remainingReward
        );

    function setOedax(address _oedaxAddress)
        external
        // onlyOwner
        ;

    function permanentlyDisableOwnerWithdrawal()
        external
        // onlyOwner
        ;

    function ownerWithdraw(
        address token,
        uint    amount
        )
        external
        // onlyOwner
        ;

    function drainAndBurn()
        external
        // onlyOwner
        ;

  function settleAuction(address auction)
        external
        // onlyOwner
        ;

    function auctionOffTokens(
        address tokenS,
        bool    sellForEther,
        uint64  ,//P,
        uint64  ,//S,
        uint8   ,//M,
        uint    //T
        )
        external
        // onlyOwner
        returns (
            address payable auctionAddr
        );
}