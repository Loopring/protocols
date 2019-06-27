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

/// @title Implementation of IOedax.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Oedax is IOedax, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    // -- Constructor --
    constructor()
        public
    {
    }

    modifier onlyAuction {
      require(auctionIdMap[msg.sender] != 0, "not an auction");
      _;
    }

    // == Public Functions ==
    function updateSettings(
        address payable _feeRecipient,
        address _curve,
        uint16  _settleGracePeriodBaseMinutes,
        uint16  _settleGracePeriodPerUserSeconds,
        uint16  _minDurationMinutes,
        uint16  _maxDurationMinutes,
        uint16  _protocolFeeBips,
        uint16  _ownerFeeBips,
        uint16  _takerFeeBips,
        uint    _creatorEtherStake
        )
        external
        onlyOwner
    {
        require(_feeRecipient != address(0x0), "zero address");
        require(_curve != address(0x0), "zero address");
        require(_settleGracePeriodBaseMinutes > 0, "zero value");
        require(_settleGracePeriodPerUserSeconds > 0, "zero value");
        require(_minDurationMinutes > 0, "zero value");
        require(_maxDurationMinutes > _minDurationMinutes, "invalid value");

        require(_protocolFeeBips <= 250, "value too large");
        require(_ownerFeeBips <= 250, "value too large");
        require(_takerFeeBips <= 250, "value too large");
        require(_creatorEtherStake > 0, "zero value");

        curveAddress = _curve;
        feeRecipient = _feeRecipient;

        settleGracePeriodBase = _settleGracePeriodBaseMinutes * 1 minutes;
        settleGracePeriodPerUser = _settleGracePeriodPerUserSeconds;
        minDuration = _minDurationMinutes * 1 minutes;
        maxDuration = _maxDurationMinutes * 1 minutes;

        protocolFeeBips = _protocolFeeBips;
        ownerFeeBips = _ownerFeeBips;
        takerFeeBips = _takerFeeBips;
        creatorEtherStake = _creatorEtherStake * 1 ether;

        emit SettingsUpdated();
    }

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
        returns (address payable auctionAddr)
    {
        require(msg.value >= creatorEtherStake, "insuffcient ETH fee");
        require(curveAddress != address(0x0), "empty curve");
        require(T2 >= minDuration && T2 <= maxDuration, "invalid duration");
        
        uint auctionId = auctions.length + 1;

        Auction auction = new Auction(
            address(this),
            auctionId,
            askToken,
            bidToken,
            minAskAmount,
            minBidAmount,
            P, S, M, T1, T2
        );

        auctionAddr = address(auction);

        // Transfer the Ether to the target auction
        (bool success, /*bytes memory data*/) = auctionAddr.call.value(creatorEtherStake)("");
        require(success, "call to auction failed");

        uint surplus = msg.value - creatorEtherStake;
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
