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


import "../lib/Ownable.sol";

import "./ICurve.sol";
import "./IOedax.sol";

/// @title IAuction
/// @author Daniel Wang  - <daniel@loopring.org>
contract IAuction is Ownable
{

    struct Queued
    {
        address user;
        uint    amount;
    }

    enum Status {PENDING, LIVE, CLOSED, SETTLED}

    struct Info
    {
      Status status;
      bool bounded;
      uint actualPrice;
      uint askPrice;
      uint bidPrice;
      uint askAmount;
      uint bidAmount;
      uint newAskShift;
      uint newBidShift;
      uint additionalAskAmountAllowed;
      uint additionalBidAmountAllowed;
      uint queuedAskAmount;
      uint queuedBidAmount;
      uint timeRemaining;
    }

    struct State
    {
      IOedax  oedax;
      ICurve  curve;

      uint    auctionId;
      address askToken;
      address bidToken;
      uint    initialAskAmount;
      uint    initialBidAmount;
      uint    startTime;

      uint32  P;
      uint32  S;
      uint8   M;
      uint    T;

      uint    askAmount;
      uint    bidAmount;
      uint    askShift;
      uint    bidShift;

      Queued[]  queue;
      bool      queueIsBid;
      uint      queueAmount;
    }

    State state;

    event Bid(
        address user,
        uint    amount,
        uint    amountQueued,
        uint    time
    );

    event Ask(
        address user,
        uint    amount,
        uint    amountQueued,
        uint    time
    );
}
