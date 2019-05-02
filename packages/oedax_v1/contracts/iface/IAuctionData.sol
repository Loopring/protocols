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

import "./ICurve.sol";
import "./IOedax.sol";

library IAuctionData
{
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

    struct QueueItem
    {
        address user;
        uint    queued;
        uint    weight;
    }

    struct Account
    {
        uint bidFeeShare;
        uint bidAccepted;
        uint bidQueued;
        uint askFeeShare;
        uint askAccepted;
        uint askQueued;
    }

    struct State
    {
      // The following files never change once initialized:
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

      // The following fields WILL change on bids and asks.
      uint    askAmount;
      uint    bidAmount;

      uint    askShift;
      uint    bidShift;

      uint[]  askShifts;
      uint[]  bidShifts;

      QueueItem[]  queue;
      bool      queueIsBid;
      uint      queueAmount;

      // user => account)
      mapping (address => Account) accounts;
    }

    event Bid(
        address user,
        uint    amount,
        uint    amountQueueItem,
        uint    time
    );

    event Ask(
        address user,
        uint    amount,
        uint    amountQueueItem,
        uint    time
    );
}