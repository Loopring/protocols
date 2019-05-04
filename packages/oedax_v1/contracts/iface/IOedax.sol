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

/// @title IOedax
/// @author Daniel Wang  - <daniel@loopring.org>
contract IOedax is Ownable
{
    // == Events ==
    event SettingsUpdated(
    );

    event TokenRankUpdated(
        address token,
        uint    rank
    );

    event AuctionCreated (
        uint    auctionId,
        address auctionAddr
    );

    event Trade(
        uint    auctionId,
        address askToken,
        address bidToken,
        uint    askAmount,
        uint    bidAmount
    );

    // == Structs ==
    struct TradeHistory {
        uint auctionId;
        uint bidAmount;
        uint askAmount;
        uint time;
    }

    // == Constants & Variables ==

    uint64      public constant PRICE_BASE = 10000000000; // 12 digits

    address payable public feeRecipient;

    address     public curveAddress;
    uint16      public settleGracePeriod;
    uint16      public minDuration;
    uint16      public maxDuration;
    uint16      public protocolFeeBips;
    uint16      public makerRewardBips;
    uint        public creationFeeEther;
    address[]   public auctions;

    // auction_address => auction_id
    mapping (address => uint) public auctionIdMap;
    // auction_creator =>  list of his auctions
    mapping (address => address[]) public creatorAuctions;

    // user_address => auction_address => participated?
    mapping (address => mapping (address => bool)) public particationMap;

    // user_address => list_of_auctions_participated
    mapping (address => address[]) public userAuctions;

    mapping (address => uint) public tokenRankMap;

    // price history
    // bid_token => ask_token => list_of_trade_history
    mapping (address => mapping(address => TradeHistory[])) public tradeHistory;


    // == Functions ==
    function updateSettings(
        address payable _feeRecipient,
        address _curve,
        uint16  _settleGracePeriodMinutes,
        uint16  _minDurationMinutes,
        uint16  _maxDurationMinutes,
        uint16  _protocolFeeBips,
        uint16  _makerRewardBips,
        uint    _creationFeeEther
        )
        external;

    /// @dev Set a token's rank. By default, all token has id 0.
    /// We require the rank of an auction's bid token must be higher
    /// than the rank of its ask token. In Oedax, Ether (address 0x0) has
    /// the highest rank.
    /// @param token The non-zero id of the price curve.
    /// @param rank The ask (base) token. Prices are in form of 'bids/asks'.
    function setTokenRank(
        address token,
        uint    rank
        )
        public;

    /// @dev Create a new auction
    /// @param askToken The ask (base) token. Prices are in form of 'bids/asks'.
    /// @param bidToken The bid (quote) token. Bid-token must have a higher rank than ask-token.
    /// @param P Numerator part of the target price `p`.
    /// @param M Price factor. `p * M` is the maximum price and `p / M` is the minimam price.
    /// @param T The maximum auction duration.
    /// @return auction Auction address.
    function createAuction(
        address askToken,
        address bidToken,
        uint64  P,
        uint8   M,
        uint    T
        )
        external
        payable
        returns (address payable auctionAddr);

    function logParticipation(
        address user
        )
        external
        returns (bool isNewUser);

    function logTrade(
        uint    auctionId,
        address askToken,
        address bidToken,
        uint    askAmount,
        uint    bidAmount
        )
        external;

    function depositToken(
        address token,
        address user,
        uint    amount
        )
        external
        returns (bool success);
}
