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


/// @title IRingSubmitter
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IRingSubmitter {
    uint16  public constant FEE_PERCENTAGE_BASE = 1000;

    /// @dev  Event emitted when a ring was successfully mined
    ///        _ringIndex     The index of the ring
    ///        _ringHash      The hash of the ring
    ///        _feeRecipient  The recipient of the matching fee
    ///        _fills         The info of the orders in the ring stored like:
    ///                       [orderHash, owner, tokenS, amountS, split, feeAmount, feeAmountS, feeAmountB]
    event RingMined(
        uint            _ringIndex,
        bytes32 indexed _ringHash,
        address indexed _feeRecipient,
        bytes           _fills
    );

    /// @dev   Event emitted when a ring was not successfully mined
    ///         _ringHash  The hash of the ring
    event InvalidRing(
        bytes32 _ringHash
    );

    /// @dev   Event emitted when fee rebates are distributed (waiveFeePercentage < 0)
    ///         _ringHash   The hash of the ring whose order(s) will receive the rebate
    ///         _orderHash  The hash of the order that will receive the rebate
    ///         _feeToken   The address of the token that will be paid to the _orderHash's owner
    ///         _feeAmount  The amount to be paid to the owner
    event DistributeFeeRebate(
        bytes32 indexed _ringHash,
        bytes32 indexed _orderHash,
        address         _feeToken,
        uint            _feeAmount
    );

    /// @dev   Submit order-rings for validation and settlement.
    /// @param data Packed data of all rings.
    function submitRings(
        bytes calldata data
        )
        external;
}
