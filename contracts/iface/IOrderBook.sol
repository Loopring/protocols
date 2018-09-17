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
    mapping(bytes32 => bool) public orderSubmitted;

    mapping(bytes32 => bytes32[]) public orders;

    struct OrderData {
        /// contains all fields that used for order hash calculation.
        /// @see OrderHelper.updateHash() for detailed information.
        bytes32[] dataArray;
    }

    event OrderSubmitted(address owner, bytes32 orderHash);

    /// order's owner is msg.sender, so no signature needed.
    /// order's owner can be a contract's address.
    /// only support LRC as fee for now.
    /// no fee split to wallet. (wallet is 0x0)
    function submitOrder(
        bytes32[] dataArray
    )
        external;

    function getOrderData(bytes32 orderHash)
        view
        external
        returns (bytes32[]);
}
