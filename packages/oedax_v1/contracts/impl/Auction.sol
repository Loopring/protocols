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

import "../iface/IAuction.sol";
import "../iface/IAuctionData.sol";
import "../iface/ICurve.sol";

import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";

import "./libauction/AuctionAccount.sol";
import "./libauction/AuctionAsks.sol";
import "./libauction/AuctionBids.sol";
import "./libauction/AuctionSettlement.sol";
import "./libauction/AuctionStatus.sol";

/// @title Implementation of IAuction.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract Auction is IAuction
{
    using MathUint          for uint;
    using AuctionAccount    for IAuctionData.State;
    using AuctionBids       for IAuctionData.State;
    using AuctionAsks       for IAuctionData.State;
    using AuctionSettlement for IAuctionData.State;
    using AuctionStatus     for IAuctionData.State;

    bool staked;

    modifier onlyOedax {
      require (msg.sender == address(state.oedax));
      _;
    }

    // -- Constructor --
    /// @param _oedax The address of the Oedax contract.
    /// @param _auctionId The auction's non-zero id.
    /// @param _askToken The ask (base) token.
    /// @param _bidToken The bid (quote) token. Prices are in form of 'bids/asks'.
    /// @param _minAskAmount The minimum amount that can be used in an ask.
    /// @param _minBidAmount The minimum amount that can be used in a bid.
    /// @param _P Numerator part of the target price `p`.
    /// @param _S Price precision -- (_P / 10**_S) is the float value of the target price.
    /// @param _M Price factor. `p * M` is the maximum price and `p / M` is the minimum price.
    /// @param _T1 The minimum auction duration in second.
    /// @param _T2 The maximum auction duration in second.
    constructor(
        address _oedax,
        uint    _auctionId,
        address _askToken,
        address _bidToken,
        uint    _minAskAmount,
        uint    _minBidAmount,
        uint64  _P,
        uint64  _S,
        uint8   _M,
        uint    _T1,
        uint    _T2
        )
        public
    {
        require(_oedax != address(0x0), "invalid oedax address");
        require(_auctionId > 0, "invalid auction id");
        require(_askToken != address(0x0) || _bidToken != address(0x0), "invalid token address");
        require(_askToken != _bidToken, "same token");

        require(_S >= 5 && _S <= 10, "invalid price precision");
        require(_P > 0 && _P <= uint(10 ** 20), "invalid target price");
        require(_M > 1 && _M <= 100, "invalid price factor");

        require(_T1 > 0 && _T1 < _T2, "invalid duration value");

        owner = tx.origin; // creator

        state.oedax = IOedax(_oedax);
        state.curve = ICurve(state.oedax.curveAddress());
        state.C = state.curve.getParamC(_M, _T1, _T2);

        state.fees = IAuctionData.Fees(
            state.oedax.protocolFeeBips(),
            state.oedax.ownerFeeBips(),
            state.oedax.takerFeeBips(),
            state.oedax.creatorEtherStake()
        );

        state.auctionId = _auctionId;
        state.askToken = _askToken;
        state.bidToken = _bidToken;
        state.minAskAmount = _minAskAmount;
        state.minBidAmount = _minBidAmount;
        state.startTime = block.timestamp;
        state.P = _P;
        state.S = uint(10) ** _S;
        state.M = _M;
        state.T = _T2;

        require(state.P / state.M < state.P, "invalid price or factor - div");
        require(state.P.mul(state.M) > state.P, "invalid price or factor - mul");

        state.askBaseUnit = uint(10) ** ERC20(_askToken).decimals();
        state.bidBaseUnit = uint(10) ** ERC20(_bidToken).decimals();

        // verify against overflow
        safeCheckTokenSupply(_askToken);
        safeCheckTokenSupply(_bidToken);
    }

    // == Public & External Functions ==
    function ()
        external
        payable
    {
        if (!staked) {
            require(tx.origin == owner, "not owner");
            require(msg.value > 0, "zero value");
            staked = true;
        } else {
            if (msg.value == 0) {
                settle();
            } else if (state.bidToken == address(0x0)) {
                state.bid(msg.value);
            } else if (state.askToken == address(0x0)) {
                state.ask(msg.value);
            } else {
                revert();
            }
        }
    }

    function bid(uint amount)
        external
        returns (uint accepted)
    {
        return state.bid(state.depositToken(state.bidToken, amount));
    }

    function ask(uint amount)
        external
        returns (uint accepted)
    {
        return state.ask(state.depositToken(state.askToken, amount));
    }

    function settle()
        public
    {
        address payable _owner = address(uint160(owner));
        state.settle(_owner);
    }

    function withdraw()
        external
    {
        IAuctionData.Status memory i = state.getAuctionStatus();
        state.withdrawFor(i, msg.sender);
    }

    function withdrawFor(
        address payable[] calldata users
        )
        external
    {
        IAuctionData.Status memory i = state.getAuctionStatus();
        for (uint j = 0; j < users.length; j++) {
            state.withdrawFor(i, users[j]);
        }
    }

    function getStatus()
        external
        view
        returns (
            bool isBounded,
            uint timeRemaining,
            uint actualPrice,
            uint askPrice,
            uint bidPrice,
            uint askAllowed,
            uint bidAllowed
        )
    {
        IAuctionData.Status memory i = state.getAuctionStatus();

        isBounded = i.isBounded;
        actualPrice = i.actualPrice;
        askPrice = i.askPrice;
        bidPrice = i.bidPrice;

        askAllowed = i.askAllowed;
        bidAllowed = i.bidAllowed;

        uint elapsed = block.timestamp - state.startTime;

        timeRemaining = i.duration > elapsed ? i.duration - elapsed : 0;
    }

    // == Internal & Private Functions ==

    function safeCheckTokenSupply(address token)
        private
        view
    {
        uint totalSupply = ERC20(token).totalSupply();
        totalSupply.mul(state.S).mul(state.S);
        totalSupply.mul(uint(10) ** 20); // max price numerator
    }
}
