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

import "../iface/IOedax.sol";

import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

import "./Auction.sol";

/// @title An Implementation of IOedax.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Oedax is IOedax, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    // -- Constructor --
    constructor()
        public
    {
        // set ETH to the highest rank.
        setTokenRank(address(0x0), 1 << 255);
    }

    modifier onlyAuction {
      require(auctionIdMap[msg.sender] != 0, "not an auction");
      _;
    }

    // == Public Functions ==
    function updateSettings(
        address payable _feeRecipient,
        address _curve,
        uint16  _settleGracePeriodMinutes,
        uint16  _minDurationMinutes,
        uint16  _maxDurationMinutes,
        uint16  _protocolFeeBips,
        uint16  _takerFeeBips,
        uint    _creationFeeEther
        )
        external
        onlyOwner
    {
        require(_feeRecipient != address(0x0), "zero address");
        require(_curve != address(0x0), "zero address");
        require(_settleGracePeriodMinutes > 0, "zero value");
        require(_minDurationMinutes > 0, "zero value");
        require(_maxDurationMinutes > _minDurationMinutes, "invalid value");

        require(_protocolFeeBips <= 250, "value too large");
        require(_takerFeeBips <= 250, "value too large");
        require(_creationFeeEther > 0, "zero value");

        curveAddress = _curve;
        feeRecipient = _feeRecipient;

        settleGracePeriod = _settleGracePeriodMinutes * 1 minutes;
        minDuration = _minDurationMinutes * 1 minutes;
        maxDuration = _maxDurationMinutes * 1 minutes;

        protocolFeeBips = _protocolFeeBips;
        takerFeeBips = _takerFeeBips;
        creationFeeEther = _creationFeeEther * 1 ether;

        emit SettingsUpdated();
    }

    function setTokenRank(
        address token,
        uint    rank
        )
        public
        onlyOwner
    {
        tokenRankMap[token] = rank;
        emit TokenRankUpdated(token, rank);
    }

    /// @dev Create a new auction
    /// @param P Numerator part of the target price `p`.
    /// @param M Price factor. `p * M` is the maximum price and `p / M` is the minimam price.
    /// @param T The maximum auction duration.
    function createAuction(
        address askToken,
        address bidToken,
        uint64  P,
        uint8   M,
        uint    T
        )
        public
        payable
        returns (address payable auctionAddr)
    {
        require(msg.value >= creationFeeEther, "insuffcient ETH fee");
        require(curveAddress != address(0x0), "empty curve");
        require(T >= minDuration && T <= maxDuration, "invalid duration");
        require(
            tokenRankMap[bidToken] > tokenRankMap[askToken],
            "bid (quote) token must have a higher rank than ask (base) token"
        );

        uint auctionId = auctions.length + 1;

        Auction auction = new Auction(
            address(this),
            auctionId,
            askToken,
            bidToken,
            P, PRICE_BASE, M, T
        );

        auctionAddr = address(auction);

        // Transfer the Ether to the target auction
        auctionAddr.transfer(creationFeeEther);
        uint surplus = msg.value - creationFeeEther;
        if (surplus > 0) {
            msg.sender.transfer(surplus);
        }

        auctionIdMap[auctionAddr] = auctionId;
        auctions.push(auctionAddr);
        creatorAuctions[msg.sender].push(auctionAddr);

        emit AuctionCreated(auctionId, auctionAddr);
    }

    function logParticipant(
        address user
        )
        external
        onlyAuction
        returns (bool isNewUser)
    {
        isNewUser = !particationMap[user][msg.sender];
        if (isNewUser) {
            particationMap[user][msg.sender] = true;
            userAuctions[user].push(msg.sender);
        }
    }

    function logSettlement(
        uint    auctionId,
        address askToken,
        address bidToken,
        uint    askAmount,
        uint    bidAmount
        )
        external
        onlyAuction
    {
        assert(auctionId > 0 && askAmount > 0 && bidAmount > 0);

        TradeHistory memory ts = TradeHistory(
            auctionId,
            askAmount,
            bidAmount,
            block.timestamp
        );
        tradeHistory[bidToken][askToken].push(ts);

        emit AuctionSettled(
            auctionId,
            askToken,
            bidToken,
            askAmount,
            bidAmount
        );
    }

    function depositToken(
        address token,
        address user,
        uint    amount
        )
        external
        onlyAuction
        returns (bool)
    {
        return token.safeTransferFrom(
            user,
            msg.sender,
            amount
        );
    }
}
