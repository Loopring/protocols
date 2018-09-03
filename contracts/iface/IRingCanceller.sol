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


/// @title IRingCanceller
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IRingCanceller {

    event OrdersCancelled(
        address indexed _owner,
        address indexed _broker,
        bytes32[]       _orderHashes
    );

    event AllOrdersCancelledForTradingPair(
        address indexed _owner,
        address indexed _broker,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    event AllOrdersCancelled(
        address indexed _owner,
        address indexed _broker,
        uint            _cutoff
    );

    /// @dev Cancel multiple orders.
    /// @param owner              The order's owner.
    ///                           and order interceptor
    /// @param orderHashes        Hashes of orders to be cancelled.
    function cancelOrders(
        address owner,
        bytes   orderHashes
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersForTradingPair(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrders(
        address owner,
        uint    cutoff
        )
        external;
}
