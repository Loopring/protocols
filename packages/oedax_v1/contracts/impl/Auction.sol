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

import "../lib/ERC20SafeTransfer.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";

import "./libauction/AuctionAccount.sol";
import "./libauction/AuctionBids.sol";
import "./libauction/AuctionAsks.sol";
import "./libauction/AuctionSettlement.sol";
import "./libauction/AuctionStatus.sol";

/// @title An Implementation of ICurve.
/// @author Daniel Wang  - <daniel@loopring.org>
contract Auction is IAuction
{
    using MathUint          for uint;
    using AuctionAccount    for IAuctionData.State;
    using AuctionBids       for IAuctionData.State;
    using AuctionAsks       for IAuctionData.State;
    using AuctionSettlement for IAuctionData.State;
    using AuctionStatus     for IAuctionData.State;

    modifier onlyOedax {
      require (msg.sender == address(state.oedax));
      _;
    }

    // -- Constructor --
    /// @param _oedax The address of the Oedax contract.
    /// @param _auctionId The auction's non-zero id.
    /// @param _askToken The ask (base) token.
    /// @param _bidToken The bid (quote) token. Prices are in form of 'bids/asks'.
    /// @param _P Numerator part of the target price `p`.
    /// @param _S Denominator part of the target price `p`.
    /// @param _M Price factor. `p * M` is the maximum price and `p / M` is the minimam price.
    /// @param _T The maximum auction duration.
    constructor(
        address _oedax,
        uint    _auctionId,
        address _askToken,
        address _bidToken,
        uint64  _P,
        uint64  _S,
        uint8   _M,
        uint    _T
        )
        public
    {

        require(_oedax != address(0x0));
        require(_auctionId > 0);
        require(_askToken != address(0x0) || _bidToken != address(0x0));

        require(_P > 0);
        require(_M > 1);
        require(_S >= 100000 && _S <= 1000000000000000000 /*18 digits*/);

        owner = msg.sender; // creator

        state.oedax = IOedax(_oedax);
        state.curve = ICurve(state.oedax.curveAddress());

        state.fees = IAuctionData.Fees(
            state.oedax.protocolFeeBips(),
            state.oedax.makerRewardBips(),
            state.oedax.creationFeeEther()
        );

        state.auctionId = _auctionId;
        state.askToken = _askToken;
        state.bidToken = _bidToken;
        state.startTime = block.timestamp;
        state.P = _P;
        state.S = _S;
        state.M = _M;
        state.T = _T ;

        require(state.P / state.M < state.P);
        require(state.P.mul(state.M) > state.P);

        state.askBaseUnit = uint(10) ** ERC20(_askToken).decimals();
        state.bidBaseUnit = uint(10) ** ERC20(_bidToken).decimals();

        // verify against overflow
        int askTotalSupply = int(ERC20(_askToken).totalSupply());
        int bidTotalSupply = int(ERC20(_bidToken).totalSupply());

        require(askTotalSupply > 0, "unsupported ask token");
        require(bidTotalSupply > 0, "unsupported bid token");

        state.S
            .mul(uint(askTotalSupply))
            .mul(uint(bidTotalSupply));
    }

    // == Public & External Functions ==
    function()
        external
        payable
    {
        if (state.bidToken == address(0x0)) {
            state.bid(msg.value);
        } else if (state.askToken == address(0x0)) {
            state.ask(msg.value);
        } else {
            revert();
        }
    }

    function bid(uint amount)
        external
    {
        uint _amount = state.depositToken(state.bidToken, amount);
        state.bid(_amount);
    }

    function ask(uint amount)
        external
    {
        uint _amount = state.depositToken(state.askToken, amount);
        state.ask(_amount);
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

         if (state.settledAt == 0) {
            timeRemaining = i.closingAt > block.timestamp ? i.closingAt - block.timestamp : 0;
         }
    }

    function getAccount(address user)
        internal
        view
        returns (
            IAuctionData.Account storage
        )
    {
        return state.getAccount(user);
    }
}
