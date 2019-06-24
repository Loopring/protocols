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

import "../iface/IProtocolFeeManager.sol";

import "..//lib/Claimable.sol";
import "../lib/BurnableERC20.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";


/// @dev See https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IOedax.so
contract IOedax {

    /// @param askToken The ask (base) token. Prices are in form of 'bids/asks'.
    /// @param bidToken The bid (quote) token.
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


/// @dev See https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IAuction.so
contract IAuction {
    function settle() public;
    function ask(uint amount) external returns (uint accepted);
}


/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract ProtocolFeeManager is IProtocolFeeManager, Claimable
{
    uint public constant MIN_ETHER_TO_KEEP = 1 ether;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    constructor(
        address _lrcAddress,
        address _userStakingPoolAddress
        )
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        require(_userStakingPoolAddress != address(0), "ZERO_ADDRESS");

        owner = msg.sender;
        allowOwnerWithdrawal = true;

        lrcAddress = _lrcAddress;
        userStakingPoolAddress = _userStakingPoolAddress;
    }

    function claim(
        uint    amount
        )
        external
    {
        require(msg.sender == userStakingPoolAddress, "UNAUTHORIZED");

        require(
            lrcAddress.safeTransfer(msg.sender, amount),
            "TRANSFER_FAILURE"
        );

        claimedReward = claimedReward.add(amount);
    }

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
        )
    {
        remainingFees = ERC20(lrcAddress).balanceOf(address(this));
        accumulatedFees = remainingFees.add(claimedReward).add(claimedDev).add(claimedBurn);

        accumulatedReward = accumulatedFees.mul(REWARD_PERCENTAGE) / 100;
        accumulatedDev = accumulatedFees.mul(DEVPOOL_PERDENTAGE) / 100;
        accumulatedBurn = accumulatedFees.sub(accumulatedReward).sub(accumulatedDev);

        remainingReward = accumulatedReward.sub(claimedReward);
        remainingDev = accumulatedDev.sub(claimedDev);
        remainingBurn = accumulatedBurn.sub(claimedBurn);
    }

    function setOedax(address _oedaxAddress)
        external
        onlyOwner
    {
        require(_oedaxAddress != oedaxAddress, "SAME_ADDRESS");
        oedaxAddress = _oedaxAddress;
    }

    function disableOwnerWithdrawal()
        external
        onlyOwner
    {
        require(allowOwnerWithdrawal, "DISABLED_ALREADY");
        require(oedaxAddress != address(0x0), "OEDAX_ADDRESS_ZERO");

        allowOwnerWithdrawal = false;
    }

    function withdraw(
        address token,
        uint    amount
        )
        external
        onlyOwner
    {
        require(allowOwnerWithdrawal, "DISABLED_ALREADY");
        require(token != lrcAddress, "INVALD_TOKEN");

        if (token == address(0)) {
            address payable recipient = address(uint160(owner));
            require(recipient.send(amount), "TRANSFER_FAILURE");
        } else {
            require(token.safeTransfer(owner, amount), "TRANSFER_FAILURE");
        }

        emit OwnerWithdrawal(token, amount);
    }

    function withdrawDevPoolAndBurn()
        external
    {
        uint remainingBurn;
        uint remainingDev;
        (, , , , , remainingBurn, remainingDev, ) = getLRCFeeStats();

        require(BurnableERC20(lrcAddress).burn(remainingBurn), "BURN_FAILURE");

        require(
            lrcAddress.safeTransferFrom(address(this), owner, remainingDev),
            "TRANSFER_FAILURE"
        );

        claimedBurn = claimedBurn.add(remainingBurn);
        claimedDev = claimedDev.add(remainingDev);

        emit LRCDrained(remainingBurn, remainingDev);
    }

   function settleAuction(address auction)
        external
    {
        require(auction != address(0), "ZERO_ADDRESS");
        IAuction(auction).settle();
    }

    function auctionOffTokens(
        address token,
        bool    sellForEther,
        uint    minAskAmount,
        uint    minBidAmount,
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

        IOedax oedax = IOedax(oedaxAddress);
        uint ethStake = oedax.creatorEtherStake();

        auctionAddr = oedax.createAuction.value(ethStake)(
            token,  // askToken
            tokenB, // bidToken
            minAskAmount,
            minBidAmount,
            P,
            S,
            M,
            T,
            T * 2
        );

        IAuction auction = IAuction(auctionAddr);

        if (token == address(0)) {
            uint balance = address(this).balance;
            require(balance > MIN_ETHER_TO_KEEP, "ZERO_BALANCE");
            auctionAddr.transfer(balance - MIN_ETHER_TO_KEEP);
        } else {
            ERC20 erc20 = ERC20(token);
            uint balance = erc20.balanceOf(address(this));
            require(balance > 0, "ZERO_BALANCE");
            require(erc20.approve(auctionAddr, balance), "AUTH_FAILED");
            auction.ask(balance);
        }

        emit AuctionStarted(
            token,
            auctionAddr
        );
    }
}
