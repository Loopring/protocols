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
pragma solidity 0.4.18;


/// @title Loopring Token Exchange Protocol Contract Interface
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringProtocol {

    ////////////////////////////////////////////////////////////////////////////
    /// Constants                                                            ///
    ////////////////////////////////////////////////////////////////////////////
    uint8   public constant FEE_SELECT_LRC               = 0;
    uint8   public constant FEE_SELECT_MARGIN_SPLIT      = 1;
    uint8   public constant FEE_SELECT_MAX_VALUE         = 1;
    uint8   public constant MARGIN_SPLIT_PERCENTAGE_BASE = 100;

    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event RingMined(
        uint                _ringIndex,
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _ringhash,
        address     indexed _miner,
        address     indexed _feeRecipient,
        bool                _isRinghashReserved
    );

    event OrderFilled(
        uint                _ringIndex,
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _ringhash,
        bytes32             _prevOrderHash,
        bytes32     indexed _orderHash,
        bytes32              _nextOrderHash,
        uint                _amountS,
        uint                _amountB,
        uint                _lrcReward,
        uint                _lrcFee
    );

    event OrderCancelled(
        uint                _time,
        uint                _blocknumber,
        bytes32     indexed _orderHash,
        uint                _amountCancelled
    );

    event CutoffTimestampChanged(
        uint                _time,
        uint                _blocknumber,
        address     indexed _address,
        uint                _cutoff
    );

    ////////////////////////////////////////////////////////////////////////////
    /// Functions                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Submit a order-ring for validation and settlement.
    /// @param addressList  List of each order's owner and tokenS. Note that next
    ///                     order's `tokenS` equals this order's `tokenB`.
    /// @param uintArgsList List of uint-type arguments in this order:
    ///                     amountS, amountB, timestamp, ttl, salt, lrcFee,
    ///                     rateAmountS.
    /// @param uint8ArgsList -
    ///                     List of unit8-type arguments, in this order:
    ///                     marginSplitPercentageList, feeSelectionList.
    /// @param buyNoMoreThanAmountBList -
    ///                     This indicates when a order should be considered
    ///                     as 'completely filled'.
    /// @param vList        List of v for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     v value of the ring signature.
    /// @param rList        List of r for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     r value of the ring signature.
    /// @param sList        List of s for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     s value of the ring signature.
    /// @param ringminer    The address that signed this tx.
    /// @param feeRecepient The recepient address for fee collection. If this is
    ///                     '0x0', all fees will be paid to the address who had
    ///                     signed this transaction, not `msg.sender`. Noted if
    ///                     LRC need to be paid back to order owner as the result
    ///                     of fee selection model, LRC will also be sent from
    ///                     this address.
    function submitRing(
        address[2][]    addressList,
        uint[7][]       uintArgsList,
        uint8[2][]      uint8ArgsList,
        bool[]          buyNoMoreThanAmountBList,
        uint8[]         vList,
        bytes32[]       rList,
        bytes32[]       sList,
        address         ringminer,
        address         feeRecepient
        ) public;

    /// @dev Cancel a order. cancel amount(amountS or amountB) can be specified
    ///      in orderValues.
    /// @param addresses          owner, tokenS, tokenB
    /// @param orderValues        amountS, amountB, timestamp, ttl, salt, lrcFee,
    ///                           cancelAmountS, and cancelAmountB.
    /// @param buyNoMoreThanAmountB -
    ///                           This indicates when a order should be considered
    ///                           as 'completely filled'.
    /// @param marginSplitPercentage -
    ///                           Percentage of margin split to share with miner.
    /// @param v                  Order ECDSA signature parameter v.
    /// @param r                  Order ECDSA signature parameters r.
    /// @param s                  Order ECDSA signature parameters s.
    function cancelOrder(
        address[3] addresses,
        uint[7]    orderValues,
        bool       buyNoMoreThanAmountB,
        uint8      marginSplitPercentage,
        uint8      v,
        bytes32    r,
        bytes32    s
        ) public;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function setCutoff(uint cutoff) public;
}
