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

import "../iface/ICurveRegistry.sol";
import "../iface/IOedax.sol";

import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/Ownable.sol";

import "./Auction.sol";


/// @title An Implementation of IOedax.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Oedax is IOedax, Ownable
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    ICurveRegistry curveRegistry;

    // -- Constructor --
    constructor(
        )
        public
    {

    }

    modifier onlyAuction {
      require(auctionIdMap[msg.sender] != 0, "not an auction");
      _;
    }

    // == Public Functions ==
    function createAuction(
        uint    curveId,
        address askToken,
        address bidToken,
        uint    initialAskAmount,
        uint    initialBidAmount,
        uint32  P, // target price
        uint32  S, // price scale
        uint8   M, // price factor
        uint    T
        )
        public
        returns (address auctionAddr)
    {
        uint auctionId = auctions.length + 1;

        Auction auction = new Auction(
            address(this),
            auctionId,
            curveRegistry.getCurve(curveId),
            askToken,
            bidToken,
            initialAskAmount,
            initialBidAmount,
            P, S, M, T
        );

        auctionAddr = address(auction);

        auctionIdMap[auctionAddr] = auctionId;
        auctions.push(auctionAddr);
        creatorAuctions[msg.sender].push(auctionAddr);

        emit AuctionCreated(auctionId, auctionAddr);
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

    // == Internal Functions ==

}
