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
pragma solidity 0.4.21;


/// @title Loopring Token Exchange Protocol Contract Interface
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
contract LoopringProtocol {
    uint8   public constant MARGIN_SPLIT_PERCENTAGE_BASE = 100;

    /// @dev Event to emit if a ring is successfully mined.
    /// _orderInfoList is an array of:
    /// [orderHash, owner, tokenS, fillAmountS, lrcReward/lrcFee, splitS/splitB].
    event RingMined(
        uint            _ringIndex,
        bytes32 indexed _ringHash,
        address         _miner,
        address         _feeRecipient,
        bytes32[]       _orderInfoList
    );

    event OrderCancelled(
        bytes32 indexed _orderHash,
        uint            _amountCancelled
    );

    event AllOrdersCancelled(
        address indexed _address,
        uint            _cutoff
    );

    event OrdersCancelled(
        address indexed _address,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    /// @dev Cancel a order. cancel amount(amountS or amountB) can be specified
    ///      in orderValues.
    /// @param addresses          owner, tokenS, tokenB, wallet, authAddr
    /// @param orderValues        amountS, amountB, validSince (second),
    ///                           validUntil (second), lrcFee, and cancelAmount.
    /// @param buyNoMoreThanAmountB -
    ///                           This indicates when a order should be considered
    ///                           as 'completely filled'.
    /// @param marginSplitPercentage -
    ///                           Percentage of margin split to share with miner.
    /// @param v                  Order ECDSA signature parameter v.
    /// @param r                  Order ECDSA signature parameters r.
    /// @param s                  Order ECDSA signature parameters s.
    function cancelOrder(
        address[5] addresses,
        uint[6]    orderValues,
        bool       buyNoMoreThanAmountB,
        uint8      marginSplitPercentage,
        uint8      v,
        bytes32    r,
        bytes32    s
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersByTradingPair(
        address token1,
        address token2,
        uint cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrders(
        uint cutoff
        )
        external;

    /// @dev Submit an order-ring for validation and settlement.
    /// @param data   Packed data containing a ring header and orders
    ///                 Ring header: 23 bytes as follows:
    ///                   - Ring size (1 byte)
    ///                   - FeeRecipient (20 bytes)
    ///                   - Fee selections (2 bytes)
    ///                 'Ring size' orders: 395 bytes each as follows:
    ///                   - Owner (32 bytes)
    ///                   - TokenS (32 bytes)
    ///                   - Wallet (32 bytes)
    ///                   - AuthAddr (32 bytes)
    ///                   - AmountS (32 bytes)
    ///                   - AmountB (32 bytes)
    ///                   - LrcFee (32 bytes)
    ///                   - RateAmountS (32 bytes)
    ///                   - OrderR (32 bytes)
    ///                   - OrderS (32 bytes)
    ///                   - RingR (32 bytes)
    ///                   - RingS (32 bytes)
    ///                   - ValidSince (in seconds) (4 bytes)
    ///                   - ValidDuration (in seconds) (4 bytes)
    ///                   - OrderV (1 byte)
    ///                   - RingV (1 byte)
    ///                   - BuyNoMoreThanAmountB (1 bit)
    ///                   - MarginSplitPercentage (7 bits)
    ///                 Note that next order's `tokenS` equals this order's `tokenB`.
    ///               * The following order members contain the result of a XOR with
    ///                 the value of the previous order:
    ///                   AuthAddr, Wallet, RingR, RingS, RingV.
    ///               * Fee selections: Bits to indicate fee selections.
    ///                 `1` represents margin split and `0` represents LRC as fee.
    ///               * BuyNoMoreThanAmountB: This indicates when a order should
    ///                 be considered as 'completely filled'.
    function submitRing(
        bytes data
        )
        public;
}
