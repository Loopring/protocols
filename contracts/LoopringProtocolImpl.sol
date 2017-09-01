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

import "zeppelin-solidity/contracts/token/ERC20.sol";
import "zeppelin-solidity/contracts/math/Math.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./utils/ArrayUtil.sol";
import "./TokenRegistry.sol";
import "./LoopringProtocol.sol";

/// @title Loopring Token Exchange Protocol Implementation Contract v1
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringProtocolImpl is LoopringProtocol {
    using SafeMath for uint;
    using Math     for uint;
    using ArrayUtil for uint;


    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    address public  lrcTokenAddress       = address(0);
    address public  tokenRegistryContract = address(0);
    uint    public  maxRingSize           = 0;
    uint    public  ringIndex             = 0;

    /// The following two maps are used to keep order fill and cancellation
    /// historical records for orders whose buyNoMoreThanAmountB
    /// values are `true`.
    mapping (bytes32 => uint) public filledS;
    mapping (bytes32 => uint) public cancelledS;

    /// The following two maps are used to keep order fill and cancellation
    /// historical records if orders whose buyNoMoreThanAmountB
    /// values are `false`.
    mapping (bytes32 => uint) public filledB;
    mapping (bytes32 => uint) public cancelledB;


    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    /// @param order        The original order
    /// @param owner        This order owner's address. This value is calculated.
    /// @param feeSelection A miner-supplied value indicating if LRC (value = 0)
    ///                     or saving share is choosen by the miner (value = 1).
    ///                     We may support more fee model in the future.
    /// @param fillAmountS  Amount of tokenS to sell, calculated by protocol.
    /// @param rateAmountS  This value is initially provided by miner and is
    ///                     calculated by based on the original information of
    ///                     all orders of the order-ring, in other orders, this
    ///                     value is independent of the order's current state.
    ///                     This value and `rateAmountB` can be used to calculate
    ///                     the proposed exchange rate calculated by miner.
    /// @param lrcReward    The amount of LRC paid by miner to order owner in
    ///                     exchange for sharing-share.
    /// @param lrcFee       The amount of LR paid by order owner to miner.
    /// @param feeS         TokenS paid to miner, as the fee of this order and
    ///                     next order, calculated by protocol.
    struct OrderState {
        Order   order;
        bytes32 orderHash;
        address owner;
        uint8   feeSelection;
        uint    rateAmountS;
        uint    availableAmountS;
        uint    fillAmountS;
        uint    lrcReward;
        uint    lrcFee;
        uint    feeS;
    }

    struct Ring {
        bytes32      ringHash;
        OrderState[] orders;
        address      miner;
        address      feeRecepient;
        bool         throwIfLRCIsInsuffcient;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Evemts                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event RingMined(
        address indexed _miner,
        address indexed _feeRecepient,
        uint    indexed _ringIndex);

    event OrderFilled(
        uint    indexed _ringIndex,
        string  indexed _orderHash,
        uint    _amountS,
        uint    _amountB,
        uint    _lrcReward,
        uint    _lrcFee);


    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////

    function LoopringProtocolImpl(
        address _lrcTokenAddress,
        address _tokenRegistryContract,
        uint    _maxRingSize
        )
        public {

        require(address(0) != _lrcTokenAddress);
        require(address(0) != _tokenRegistryContract);
        require(_maxRingSize >= 2);

        lrcTokenAddress = _lrcTokenAddress;
        tokenRegistryContract = _tokenRegistryContract;
        maxRingSize     = _maxRingSize;
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
        )
        public {

        // Check ring size
        uint ringSize = tokenSList.length;
        require(ringSize > 1 && ringSize <= maxRingSize);
        
        verifyTokensRegistered(tokenSList);

        bytes32 ringHash = getRingHash(
            ringSize,
            feeRecepient,
            throwIfLRCIsInsuffcient,
            vList,
            rList,
            sList
        );

        address minerAddress = calculateSignerAddress(
            ringHash,
            vList[ringSize],
            rList[ringSize],
            sList[ringSize]
        );

        // Assemble input data into a struct so we can pass it to functions.
        var orders = assembleOrders(
            ringSize,
            tokenSList,
            uintArgsList,
            uint8ArgsList,
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList);

        if (feeRecepient == address(0)) {
            feeRecepient = minerAddress;
        }

        var ring = Ring(
            ringHash,
            orders,
            minerAddress,
            feeRecepient,
            throwIfLRCIsInsuffcient);

        verifyMinerSuppliedFillRates(ring);

        scaleOrdersBasedOnHistory(ring);

        calculateRingOrderFillAmount(ring);

        calculateRingOrderFees(ring);
    }

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
        uint8      savingSharePercentage,
        bool       buyNoMoreThanAmountB,
        uint8      v,
        bytes32    r,
        bytes32    s
        )
        public {

    }



    ////////////////////////////////////////////////////////////////////////////
    /// Internal & Private Functions                                         ///
    ////////////////////////////////////////////////////////////////////////////

    function verifyTokensRegistered(address[] tokens) internal constant {
        var registryContract = TokenRegistry(tokenRegistryContract);
        for (uint i = 0; i < tokens.length; i++) {
            require(registryContract.isTokenRegistered(tokens[i]));
        }
    }

    function verifyMinerSuppliedFillRates(Ring ring)
        internal
        constant {

    }

    /// TODO(daniel): not done right;
    function calculateRingOrderFees(Ring ring)
        internal
        constant {


        uint ringSize = ring.orders.length;
        uint minerLrcSpendable = getLRCSpendable(ring.feeRecepient);

        for (uint i = 0; i < ringSize; i++) {
            var state = ring.orders[i];

            uint j = i.next(ringSize);
            var next = ring.orders[j];

            if (state.feeSelection == FEE_SELECT_LRC) {
                uint lrcSpendable = getLRCSpendable(state.owner);
                if (lrcSpendable < state.order.lrcFee) {
                    if (ring.throwIfLRCIsInsuffcient) {
                        revert();
                    }

                    state.lrcFee = lrcSpendable;
                }
                else {
                    state.lrcFee = state.order.lrcFee;
                }

            } else if (state.feeSelection == FEE_SELECT_SAVING_SHARE) {
                if (minerLrcSpendable >= state.order.lrcFee) {
                    uint saving = scale(
                        state.fillAmountS,
                        state.order.amountB,
                        state.order.amountS) - next.fillAmountS;

                    require(saving >= 0);

                    uint savingShare = saving
                        .mul(state.order.savingSharePercentage)
                        .div(SAVING_SHARE_PERCENTAGE_BASE);

                    if (savingShare > 0) {
                        minerLrcSpendable -= state.order.lrcFee;
                        state.lrcReward = scale(
                            state.fillAmountS,
                            state.order.lrcFee,
                            state.order.amountS);
                    }
                }
            } else revert();

        }

    }

    function calculateRingOrderFillAmount(Ring ring)
        internal
        constant {

        uint ringSize = ring.orders.length;
        uint smallestOrderIndex = 0;

        for (uint i = 0; i < ringSize; i++) {
            smallestOrderIndex = calculateOrderFillAmount(ring, i);
        }

        for (i = 0; i < smallestOrderIndex; i++) {
            calculateOrderFillAmount(ring, i);
        }
    }

    function calculateOrderFillAmount(
        Ring ring,
        uint orderIndex
        )
        internal
        constant
        returns (uint indexOfSmallerOrder) {


        var state = ring.orders[orderIndex];

        uint nextIndex = orderIndex.next(ring.orders.length);
        var next = ring.orders[nextIndex];

        state.fillAmountS = state.fillAmountS.min256(state.availableAmountS);

        uint fillAmountB  = scale(
            state.fillAmountS,
            next.rateAmountS,  // state.rateAmountB
            state.rateAmountS)
            .min256(next.availableAmountS);

        if (state.order.buyNoMoreThanAmountB) {
            fillAmountB = fillAmountB.min256(state.order.amountB);
        }

        if (fillAmountB > next.fillAmountS) {
            indexOfSmallerOrder = nextIndex;
        } else {
            state.fillAmountS  = scale(
                fillAmountB,
                state.rateAmountS,
                next.rateAmountS);

            next.fillAmountS = fillAmountB;
        }
    }


    function scaleOrdersBasedOnHistory(Ring ring)
        internal
        constant {

        for (uint i = 0; i < ring.orders.length; i++) {
            var state = ring.orders[i];
            var order = state.order;

            if (order.buyNoMoreThanAmountB) {
                uint amountB = order.amountB
                    .sub(cancelledB[state.orderHash])
                    .sub(filledB[state.orderHash]);

                order.amountS = scale(
                    amountB,
                    order.amountS,
                    order.amountB);

                order.lrcFee = scale(
                    amountB,
                    order.lrcFee,
                    order.amountB);

                order.amountB = amountB;
            } else {
                uint amountS = order.amountS
                    .sub(cancelledS[state.orderHash])
                    .sub(filledS[state.orderHash]);

                order.amountB = scale(
                    amountS,
                    order.amountB,
                    order.amountS);

                order.lrcFee = scale(
                    amountS,
                    order.lrcFee,
                    order.amountS);

                order.amountS = amountS;
            }

            // Initialize fill amounts
            state.fillAmountS = order.amountS;
        }
    }


  function scale(
        uint xx,
        uint y,
        uint x
        )
        internal
        constant
        returns (uint yy) {

        require(xx > 0 && y > 0 && x > 0);
        yy = xx.mul(y).div(x);
        require(yy > 0);
    }

    function getSpendable(
        address _tokenAddress,
        address _owner
        )
        internal
        constant
        returns (uint) {

        var token = ERC20(_tokenAddress);
        return token
            .allowance(_owner, address(this))
            .min256(token.balanceOf(_owner));
    }

    function getLRCSpendable(address _owner)
        internal
        constant
        returns (uint) {

        return getSpendable(lrcTokenAddress, _owner);
    }

    /// @dev        assmble order parameters into Order struct.
    /// @return     A list of orders.
    function assembleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   uintArgsList,
        uint8[2][]  uint8ArgsList,
        bool[]      buyNoMoreThanAmountBList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        internal
        constant
        returns (OrderState[]) {

        require(ringSize == tokenSList.length);
        require(ringSize == uintArgsList.length);
        require(ringSize == uint8ArgsList.length);
        require(ringSize == buyNoMoreThanAmountBList.length);
        require(ringSize + 1 == vList.length);
        require(ringSize + 1 == rList.length);
        require(ringSize + 1 == sList.length);

        var orders = new OrderState[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            uint j = i.prev(ringSize);

            var order = Order(

                tokenSList[i],
                tokenSList[j],
                uintArgsList[i][0],
                uintArgsList[i][1],
                uintArgsList[i][2],
                uintArgsList[i][3],
                uintArgsList[i][4],
                buyNoMoreThanAmountBList[i],
                uint8ArgsList[i][0],
                vList[i],
                rList[i],
                sList[i]);

            validateOrder(order);

            bytes32 orderHash = calculateOrderHash(order);
            address orderOwner = calculateSignerAddress(
                orderHash,
                order.v,
                order.r,
                order.s);

            orders[i] = OrderState(
                order,
                orderHash,
                orderOwner,
                uint8ArgsList[i][1],  // feeSelectionList
                uintArgsList[i][5],   // rateAmountS
                getSpendable(order.tokenS, orderOwner),
                0,   // fillAmountS, to be initialized to amountS after scaling.
                0,   // lrcReward, to be calculated.
                0,   // lrcFee, to be calculated.
                0    // feeS, to be calculated.
                );

            require(orders[i].availableAmountS > 0);
        }

        return orders;
    }

    /// @dev validate order's parameters are OK.
    function validateOrder(Order order) internal constant {
        require(order.tokenS != address(0));
        require(order.tokenB != address(0));
        require(order.amountS > 0);
        require(order.amountB > 0);
        require(order.expiration > block.number);
        require(order.rand > 0);
        require(order.savingSharePercentage >= 0);
        require(order.savingSharePercentage <= SAVING_SHARE_PERCENTAGE_BASE);
    }

    /// @dev        Validate miner's signature.
    /// @return     Ring-miner's address.
    function validateMinerSignatureForAddress(
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList,
        address     feeRecepient,
        bool        throwIfLRCIsInsuffcient
        )
        internal
        constant
        returns (address addr) {

        return address(0);
    }

    /// @dev        Validate order's signature.
    /// @return     Order owner's address.
    function validateOrderOwnerSignatureForAddress(
        )
        internal
        constant
        returns (address addr) {

        return address(0);
    }


    /// @dev    Calculate the hash of a ring.
    ///         To calculate the has of a ring, first concatenate each order's
    ///         `v`, `r`, and `s` in the given order, followed by 'feeREcepient',
    ///         and `throwIfLRCIsInsuffcient`, tthen calculate Keccak256 hash.
    function getRingHash(
        uint ringSize,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        internal
        constant
        returns (bytes32) {

        uint targetSize = 65 * ringSize;
        bytes memory targetBytes = new bytes(targetSize);

        uint d = 0;
        for (uint i = 0; i < ringSize; i++) {
            targetBytes[d++] = byte(vList[i]);
            for (uint j = 0; j < 32; j++) {
                targetBytes[d++] = byte(rList[i][j]);
            }
            for (j = 0; j < 32; j++) {
                targetBytes[d++] = byte(sList[i][j]);
            }
        }

        return keccak256(
            targetBytes,
            feeRecepient,
            throwIfLRCIsInsuffcient);
    }

    /// @dev Get the Keccak-256 hash of order with specified parameters.
    function calculateOrderHash(Order order)
        internal
        constant
        returns (bytes32) {

        return keccak256(
            address(this),
            order.tokenS,
            order.tokenB,
            order.amountS,
            order.amountB,
            order.expiration,
            order.rand,
            order.lrcFee,
            order.buyNoMoreThanAmountB,
            order.savingSharePercentage);
    }

    /// @dev Get signer's address.
    function calculateSignerAddress(
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
        constant
        returns (address) {

        return ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s);
    }

}
