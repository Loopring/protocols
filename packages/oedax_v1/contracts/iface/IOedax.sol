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

    event AuctionCreated (
        uint    auctionId,
        address auctionAddr
    );

    event AuctionSettled(
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

    // == Variables ==
    address payable public feeRecipient;

    address     public curveAddress;
    uint16      public settleGracePeriodBase;
    uint16      public settleGracePeriodPerUser;
    uint32      public minDuration;
    uint32      public maxDuration;
    uint16      public protocolFeeBips;
    uint16      public ownerFeeBips;
    uint16      public takerFeeBips;
    uint        public creatorEtherStake;
    address[]   public auctions;

    // auction_address => auction_id
    mapping (address => uint) public auctionIdMap;
    // auction_creator =>  list of his auctions
    mapping (address => address[]) public creatorAuctions;

    // user_address => auction_address => participated?
    mapping (address => mapping (address => bool)) public particationMap;

    // user_address => list_of_auctions_participated
    mapping (address => address[]) public userAuctions;

    // price history
    // bid_token => ask_token => list_of_trade_history
    mapping (address => mapping(address => TradeHistory[])) public tradeHistory;

    // == Functions ==
    /// @dev Update Oedax global settings.
    ///      Note that unlike other settings, `_settleGracePeriodMinutes` will also
    ///      affect existing ongoing auctions.
    ///      Only Oedax owner can invoke this method.
    /// @param _feeRecipient The address to collect all fees
    /// @param _curve The address of price curve contract
    /// @param  _settleGracePeriodBaseMinutes The base time window in which
    ///          the auction owner needs to settle the auction.
    /// @param  _settleGracePeriodPerUserSeconds The delta time window in which
    ///          the auction owner needs to settle the auction.
    /// @param _minDurationMinutes The minimum auction duration
    /// @param _maxDurationMinutes The maximum auction duration
    /// @param _protocolFeeBips The bips (0.01%) of bid/ask tokens to pay the protocol
    /// @param _takerFeeBips The bips of bid/ask tokens to use as maker rebates
    /// @param _creatorEtherStake The amount of Ether auction creators must stake
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
        // onlyOwner
        ;

    /// @dev Create a new auction
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

    /// @dev Used by an auction to log a unique user.
    /// @param user The address of the user
    /// @return isNewUser True if this is the first time this user join the auction,
    ///         false otherwise.
    function logParticipant(
        address user
        )
        external
        // onlyAuction
        returns (bool isNewUser);

    /// @dev Used by an auction to log its settlement.
    /// @param auctionId The auction's id
    /// @param askToken The address of the ask token
    /// @param bidToken The address of the bid token
    /// @param askAmount The total amount of ask tokens
    /// @param bidAmount The total amount of bid tokens
    function logSettlement(
        uint    auctionId,
        address askToken,
        address bidToken,
        uint    askAmount,
        uint    bidAmount
        )
        external
        // onlyAuction
        ;

    /// @dev Used by an auction to deposit ERC20 tokens.
    /// @param token The address of the ERC20 token
    /// @param user  The source address
    /// @param amount The amount of tokens to be transferred
    /// @return success True if the transfer is successful, false otherwise.
    function depositToken(
        address token,
        address user,
        uint    amount
        )
        external
        // onlyAuction
        returns (bool);
}
