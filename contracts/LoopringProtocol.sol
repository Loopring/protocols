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
pragma solidity ^0.4.11;

/// TODO(daniel): rename to LoopringProtocol.sol

/// @title Loopring Token Exchange Protocol Contract Interface
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringProtocol {

    ////////////////////////////////////////////////////////////////////////////
    /// Constants                                                            ///
    ////////////////////////////////////////////////////////////////////////////
    uint    public constant FEE_SELECT_LRC               = 0;
    uint    public constant FEE_SELECT_SAVING_SHARE      = 1;
    uint    public constant SAVING_SHARE_PERCENTAGE_BASE = 10000;


    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    /// @param tokenS       Token to sell.
    /// @param tokenB       Token to buy.
    /// @param amountS      Maximum amount of tokenS to sell.
    /// @param amountB      Minimum amount of tokenB to buy if all amountS sold.
    /// @param expiration   Indicating when this order will expire. If the value
    ///                     is smaller than `now`, it will be treated as
    ///                     Ethereum block height, otherwise it will be treated
    ///                     as Ethereum block time (in second).
    /// @param rand         A random number to make this order's hash unique.
    /// @param lrcFee       Max amount of LRC to pay for miner. The real amount
    ///                     to pay is proportional to fill amount.
    /// @param buyNoMoreThanAmountB -
    ///                     If true, this order does not accept buying more
    ///                     than `amountB`.
    /// @param savingSharePercentage -
    ///                     The percentage of savings paid to miner.
    /// @param v            ECDSA signature parameter v.
    /// @param r            ECDSA signature parameters r.
    /// @param s            ECDSA signature parameters s.
    struct Order {
        address tokenS;
        address tokenB;
        uint    amountS;
        uint    amountB;
        uint    expiration;
        uint    rand;
        uint    lrcFee;
        bool    buyNoMoreThanAmountB;
        uint8   savingSharePercentage;
        uint8   v;
        bytes32 r;
        bytes32 s;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Submit a order-ring for validation and settlement.
    /// @param tokenSList   List of each order's tokenS. Note that next order's
    ///                     `tokenS` equals this order's `tokenB`.
    /// @param uintArgsList List of uint-type arguments in this order:
    ///                     amountS,AmountB,rateAmountS,expiration,rand,lrcFee.
    /// @param uint8ArgsList -
    ///                     List of unit8-type arguments, in this order:
    ///                     savingSharePercentageList,feeSelectionList.
    /// @param vList        List of v for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     v value of the ring signature.
    /// @param rList        List of r for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     r value of the ring signature.
    /// @param sList        List of s for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     s value of the ring signature.
    /// @param feeRecepient The recepient address for fee collection. If this is
    ///                     '0x0', all fees will be paid to the address who had
    ///                     signed this transaction, not `msg.sender`. Noted if
    ///                     LRC need to be paid back to order owner as the result
    ///                     of fee selection model, LRC will also be sent from
    ///                     this address.
    /// @param throwIfLRCIsInsuffcient -
    ///                     If true, throw exception if any order's spendable
    ///                     LRC amount is smaller than requried; if false, ring-
    ///                     minor will give up collection the LRC fee.
    function submitRing(
        address[]   tokenSList,
        uint[6][]   uintArgsList,
        uint8[2][]  uint8ArgsList,
        bool[]      buyNoMoreThanAmountBList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList,
        address     feeRecepient,
        bool        throwIfLRCIsInsuffcient
        ) public;

    /// @dev Submit ring fingerprint.
    /// @param ringSize ring order size.
    /// @param feeRecepient The recepient address for fee collection. If this is
    ///                     '0x0', all fees will be paid to the address who had
    ///                     signed this transaction, not `msg.sender`. Noted if
    ///                     LRC need to be paid back to order owner as the result
    ///                     of fee selection model, LRC will also be sent from
    ///                     this address.
    /// @param throwIfLRCIsInsuffcient -
    ///                     If true, throw exception if any order's spendable
    ///                     LRC amount is smaller than requried; if false, ring-
    ///                     minor will give up collection the LRC fee.
    /// @param vList        List of v for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     v value of the ring signature.
    /// @param rList        List of r for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     r value of the ring signature.
    /// @param sList        List of s for each order. This list is 1-larger than
    ///                     the previous lists, with the last element being the
    ///                     s value of the ring signature.
    function submitRingFingerPrint(
        uint ringSize,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        public;

    /// @dev Cancel a order. cancel amount(amountS or amountB) can be specified in orderValues.
    /// @param tokenAddresses     tokenS,tokenB
    /// @param orderValues        amountS,amountB,expiration,rand,lrcFee,cancelAmountS,cancelAmountB
    /// @param savingSharePercentage -
    /// @param buyNoMoreThanAmountB -
    /// @param v                  Order ECDSA signature parameter v.
    /// @param r                  Order ECDSA signature parameters r.
    /// @param s                  Order ECDSA signature parameters s.
    function cancelOrder(
        address[2] tokenAddresses,
        uint[7]    orderValues,
        bool       buyNoMoreThanAmountB,
        uint8      savingSharePercentage,
        uint8      v,
        bytes32    r,
        bytes32    s
        ) public;
}
