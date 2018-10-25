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


/// @title IOrderBook
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract IOrderBook {
    // The map of registered order hashes
    mapping(bytes32 => bool) public orderSubmitted;

    /// @dev  Event emitted when an order was successfully submitted
    ///        orderHash      The hash of the order
    ///        orderData      The data of the order as passed to submitOrder()
    event OrderSubmitted(
        bytes32 orderHash,
        bytes   orderData
    );

    /// @dev   Submits an order to the on-chain order book.
    ///        No signature is needed. The order can only be sumbitted by its
    ///        owner or its broker (the owner can be the address of a contract).
    /// @param orderData The data of the order. Contains all fields that are used
    ///        for the order hash calculation.
    ///        See OrderHelper.updateHash() for detailed information.
    function submitOrder(
        bytes orderData
        )
        external
        returns (bytes32);
}
