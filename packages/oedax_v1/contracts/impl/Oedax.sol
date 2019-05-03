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
pragma experimental ABIEncoderV2;

import "../iface/ICurveRegistry.sol";
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

    ICurveRegistry curveRegistry;

    uint16 settleGracePeriod;
    uint16 minDuration;
    uint16 maxDuration;

    // -- Constructor --
    constructor(
        address _curveRegistry
        )
        public
    {
        require(_curveRegistry != address(0x0), "zero address");
        owner = msg.sender;
        curveRegistry = ICurveRegistry(_curveRegistry);

        // set ETH to the highest rank.
        setTokenRank(address(0x0), ~uint32(0));
    }

    modifier onlyAuction {
      require(auctionIdMap[msg.sender] != 0, "not an auction");
      _;
    }

    // == Public Functions ==
    function updateSettings(
        uint16 _settleGracePeriodMinutes,
        uint16 _minDurationMinutes,
        uint16 _maxDurationMinutes
        )
        external
        onlyOwner
    {
        require(_settleGracePeriodMinutes > 0, "zero value");
        require(_minDurationMinutes > 0, "zero value");
        require(_maxDurationMinutes > _minDurationMinutes, "invalid value");

        settleGracePeriod = _settleGracePeriodMinutes * 1 minutes;
        minDuration = _minDurationMinutes * 1 minutes;
        maxDuration = _maxDurationMinutes * 1 minutes;

        emit SettingsUpdated();
    }

    function setTokenRank(
        address token,
        uint32  rank
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
        uint    curveId,
        address askToken,
        address bidToken,
        uint64  P,
        uint8   M,
        uint    T
        )
        public
        payable
        returns (address auctionAddr)
    {
        require(T >= minDuration && T <= maxDuration, "invalid duration");
        require(
            tokenRankMap[bidToken] > tokenRankMap[askToken],
            "bid (quote) token must have a higher rank than ask (base) token"
        );

        uint auctionId = auctions.length + 1;

        Auction auction = new Auction(
            address(this),
            auctionId,
            curveRegistry.getCurve(curveId),
            askToken,
            bidToken,
            P, PRICE_BASE, M, T
        );

        auctionAddr = address(auction);

        auctionIdMap[auctionAddr] = auctionId;
        auctions.push(auctionAddr);
        creatorAuctions[msg.sender].push(auctionAddr);

        emit AuctionCreated(auctionId, auctionAddr);
    }

    function logParticipation(
        address user
        )
        public
        onlyAuction
        returns (bool isNewUser)
    {
        isNewUser = !particationMap[user][msg.sender];
        if (isNewUser) {
            particationMap[user][msg.sender] = true;
            userAuctions[user].push(msg.sender);
        }
    }

    function logTrade(
        uint    auctionId,
        address askToken,
        address bidToken,
        uint    askAmount,
        uint    bidAmount
        )
        public
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

        emit Trade(
            auctionId,
            askToken,
            bidToken,
            askAmount,
            bidAmount
        );
    }

    function transferToken(
        address token,
        address user,
        uint    amount
        )
        public
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
