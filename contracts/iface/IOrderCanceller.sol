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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";


/// @title IOrderCanceller
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IOrderCanceller {

    event OrdersCancelled(
        address indexed _broker,
        bytes32[]       _orderHashes
    );

    event AllOrdersCancelledForTradingPair(
        address indexed _broker,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    event AllOrdersCancelled(
        address indexed _broker,
        uint            _cutoff
    );

    event OrdersCancelledByBroker(
        address indexed _broker,
        address indexed _owner,
        bytes32[]       _orderHashes
    );

    event AllOrdersCancelledForTradingPairByBroker(
        address indexed _broker,
        address indexed _owner,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    event AllOrdersCancelledByBroker(
        address indexed _broker,
        address indexed _owner,
        uint            _cutoff
    );

    /// @dev Cancel multiple orders.
    ///      msg.sender needs to be the broker of the orders you want to cancel.
    /// @param orderHashes Hashes of the orders to be cancelled.
    function cancelOrders(
        bytes   orderHashes
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param token1 The first token of the trading pair
    /// @param token2 The second token of the trading pair
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersForTradingPair(
        address token1,
        address token2,
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    ///        msg.sender is the broker of the orders for which the cutoff is set.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrders(
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    ///        This function can be used by brokers to cancel orders of an owner.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param owner The owner of the orders the broker wants to cancel
    /// @param token1 The first token of the trading pair
    /// @param token2 The second token of the trading pair
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersForTradingPairOfOwner(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    ///        This function can be used by brokers to cancel orders of an owner.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param owner The owner of the orders the broker wants to cancel
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersOfOwner(
        address owner,
        uint    cutoff
        )
        external;
}
