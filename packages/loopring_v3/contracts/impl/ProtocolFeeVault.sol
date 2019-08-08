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
pragma solidity 0.5.10;

import "../iface/IProtocolFeeVault.sol";

import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
import "../lib/BurnableERC20.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/ReentrancyGuard.sol";


/// @dev See https://github.com/Loopring/protocols/blob/master/packages/oedax_v1/contracts/iface/IOedax.so
contract IOedax
{
    /// @param askToken The ask (base) token. Prices are in form of 'bids/asks'.
    /// @param bidToken The bid (quote) token.
    /// @param minAskAmount The minimum ask amount.
    /// @param minBidAmount The minimum bid amount.
    /// @param P Numerator part of the target price `p`.
    /// @param S Price precision -- (_P / 10**_S) is the float value of the target price.
    /// @param M Price factor. `p * M` is the maximum price and `p / M` is the minimum price.
    /// @param T1 The minimum auction duration in second.
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
contract IAuction
{
    function settle() public;
    function ask(uint amount) external returns (uint accepted);
}


/// @title An Implementation of IUserStakingPool.
/// @author Daniel Wang - <daniel@loopring.org>
contract ProtocolFeeVault is Claimable, ReentrancyGuard, IProtocolFeeVault
{
    uint public constant MIN_ETHER_TO_KEEP = 1 ether;
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    constructor(
        address _lrcAddress,
        address _userStakingPoolAddress
        )
        Claimable()
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        require(_userStakingPoolAddress != address(0), "ZERO_ADDRESS");

        allowOwnerWithdrawal = true;
        lrcAddress = _lrcAddress;
        userStakingPoolAddress = _userStakingPoolAddress;
    }

    function claimStakingReward(
        uint amount
        )
        external
        nonReentrant
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
            uint accumulatedDAOFund,
            uint accumulatedReward,
            uint remainingFees,
            uint remainingBurn,
            uint remainingDAOFund,
            uint remainingReward
        )
    {
        remainingFees = ERC20(lrcAddress).balanceOf(address(this));
        accumulatedFees = remainingFees.add(claimedReward).add(claimedDAOFund).add(claimedBurn);

        accumulatedReward = accumulatedFees.mul(REWARD_PERCENTAGE) / 100;
        accumulatedDAOFund = accumulatedFees.mul(DAO_PERDENTAGE) / 100;
        accumulatedBurn = accumulatedFees.sub(accumulatedReward).sub(accumulatedDAOFund);

        remainingReward = accumulatedReward.sub(claimedReward);
        remainingDAOFund = accumulatedDAOFund.sub(claimedDAOFund);
        remainingBurn = accumulatedBurn.sub(claimedBurn);
    }

    function setOedax(address _oedaxAddress)
        external
        onlyOwner
    {
        require(_oedaxAddress != oedaxAddress, "SAME_ADDRESS");
        oedaxAddress = _oedaxAddress;
    }

    function setDAO(address _daoAddress)
        external
        onlyOwner
    {
        require(_daoAddress != daoAddress, "SAME_ADDRESS");
        daoAddress = _daoAddress;
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
        nonReentrant
    {
        require(allowOwnerWithdrawal, "DISABLED_ALREADY");
        require(token != lrcAddress, "INVALD_TOKEN");

        if (token == address(0)) {
            owner.transferETH(amount, gasleft());
        } else {
            require(token.safeTransfer(owner, amount), "TRANSFER_FAILURE");
        }

        emit OwnerWithdrawal(token, amount);
    }

    function withdrawLRCToDAO()
        external
        nonReentrant
    {
        require(daoAddress != address(0), "ZERO_DAO_ADDRESS");
        uint amountDAO;
        uint amountBurn;
        (, , , , , amountBurn, amountDAO, ) = getLRCFeeStats();

        require(
            lrcAddress.safeTransferFrom(address(this), daoAddress, amountDAO),
            "TRANSFER_FAILURE"
        );

        require(BurnableERC20(lrcAddress).burn(amountBurn), "BURN_FAILURE");

        claimedBurn = claimedBurn.add(amountBurn);
        claimedDAOFund = claimedDAOFund.add(amountDAO);

        emit LRCWithdrawnToDAO(amountDAO, amountBurn);
    }

    function settleAuction(address auction)
        external
        nonReentrant
    {
        require(auction != address(0), "ZERO_ADDRESS");
        IAuction(auction).settle();
    }

    function auctionOffTokens(
        address tokenS,
        uint    amountS,
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
        nonReentrant
        returns (
            address payable auctionAddr
        )
    {
        require(oedaxAddress != address(0), "NO_OEDAX_SET");
        require(amountS > 0, "ZERO_AMOUNT");

        address tokenB = sellForEther ? address(0) : lrcAddress;
        require(tokenS != tokenB, "SAME_TOKEN");

        IOedax oedax = IOedax(oedaxAddress);
        uint ethStake = oedax.creatorEtherStake();

        auctionAddr = oedax.createAuction.value(ethStake)(
            tokenS,  // askToken
            tokenB,  // bidToken
            minAskAmount,
            minBidAmount,
            P,
            S,
            M,
            T,
            T * 2
        );

        if (tokenS == address(0)) {
            auctionAddr.transferETH(amountS, gasleft());
        } else {
            require(ERC20(tokenS).approve(auctionAddr, amountS), "AUTH_FAILED");
            IAuction(auctionAddr).ask(amountS);
        }

        emit AuctionStarted(
            tokenS,
            amountS,
            tokenB,
            auctionAddr
        );
    }
}
