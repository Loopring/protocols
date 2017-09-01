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

/// @title Loopring Token Exchange Contract - v0.1
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringProtocol {
    using SafeMath for uint;
    using Math     for uint;

    uint    public constant FEE_SELECT_LRC               = 0;
    uint    public constant FEE_SELECT_SAVING_SHARE      = 1;
    uint    public constant SAVING_SHARE_PERCENTAGE_BASE = 10000;

    address public  lrcTokenAddress                  = address(0);
    uint    public  maxRingSize                      = 0;
    uint    public  expirationAsBlockHeightThreshold = 0;
    uint    public  ringIndex                        = 0;

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

    /// @param protocol     Protocol address
    /// @param tokenS       Token to sell
    /// @param tokenB       Token to buy
    /// @param amountS      Maximum amount of tokenS to sell
    /// @param amountB      Minimum amount of tokenB to buy
    /// @param expiration   Indicating when this order will expire. If the value
    ///                     is smaller than EXPIRATION_AS_BLOCKHEIGHT_THRESHOLD,
    ///                     it will be treated as Ethereum block height,
    ///                     otherwise it will be treated as Ethereum block
    ///                     time (in second).
    /// @param rand         A random number to make this order's hash unique.
    /// @param lrcFee       Max amount of LRC to pay for miner. The real amount
    ///                     to pay is proportional to fill amount.
    /// @param savingSharePercentage
    ///                     The percentage of savings paid to miner.
    /// @param buyNoMoreThanAmountB
    ///                     If true, this order does not accept buying more than
    ///                     amountB tokenB.
    struct Order {
        address protocol;
        address tokenS;
        address tokenB;
        uint    amountS;
        uint    amountB;
        uint    expiration;
        uint    rand;
        uint    lrcFee;
        uint8   savingSharePercentage;
        bool    buyNoMoreThanAmountB;
        uint8   v;
        bytes32 r;
        bytes32 s;
    }

    /// @param order        The order
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
        OrderState[] orders;
        address      miner;
        address      feeRecepient;
        bool         throwIfTokenAllowanceOrBalanceIsInsuffcient;
        uint8        v;
        bytes32      r;
        bytes32      s;
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
        uint    _lrcFee,
        uint    _feeS,
        uint    _feeB);

    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////
    function LoopringProtocol(
        address _lrcTokenAddress,
        uint    _maxRingSize,
        uint    _expirationAsBlockHeightThreshold
        ) public {

        require(address(0) != _lrcTokenAddress);
        require(_maxRingSize >= 2);
        require(_expirationAsBlockHeightThreshold > block.number * 100);

        lrcTokenAddress                  = _lrcTokenAddress;
        maxRingSize                      = _maxRingSize;
        expirationAsBlockHeightThreshold = _expirationAsBlockHeightThreshold;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////
    function submitRing(
        address     feeRecepient,
        bool        throwIfTokenAllowanceOrBalanceIsInsuffcient,
        address[]   tokenSList,
        uint[6][]   uintArgsList, // amountS,AmountB,rateAmountS,expiration,rand,lrcFee
        uint8[2][]  uint8ArgsList, // savingSharePercentageList,feeSelectionList
        bool[]      buyNoMoreThanAmountBList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        public {

        // Verify data integrity.
        uint ringSize = tokenSList.length;
        require(ringSize > 1 && ringSize <= maxRingSize);

        var orders = assambleOrders(
            ringSize,
            tokenSList,
            uintArgsList, // amountS,AmountB,rateAmountS,expiration,rand,lrcFee
            uint8ArgsList, // savingSharePercentageList,feeSelectionList
            buyNoMoreThanAmountBList,
            vList,
            rList,
            sList);

        address minerAddress = validateMinerSignatureForAddress();

        if (feeRecepient == address(0)) {
            feeRecepient = minerAddress;
        }

        var ring = Ring(
            orders,
            minerAddress,
            feeRecepient,
            throwIfTokenAllowanceOrBalanceIsInsuffcient,
            vList[ringSize],
            rList[ringSize],
            sList[ringSize]);

        checkRingMatchingRate(ring);

        scaleOrdersBasedOnHistory(ring);

        calculateRingOrderFillAmount(ring);

        calculateRingOrderFees(ring);
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Internal & Private Functions                                         ///
    ////////////////////////////////////////////////////////////////////////////

    function checkRingMatchingRate(Ring ring)
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

            uint j = (i + 1) % ringSize;
            var next = ring.orders[j];

            if (state.feeSelection == FEE_SELECT_LRC) {
                uint lrcSpendable = getLRCSpendable(state.owner);
                if (lrcSpendable < state.order.lrcFee) {
                    if (ring.throwIfTokenAllowanceOrBalanceIsInsuffcient) {
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

        uint nextIndex = (orderIndex + 1) % ring.orders.length;
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

    function assambleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   uintArgsList, // amountS,AmountB,expiration,rand,lrcFee,rateAmountS
        uint8[2][]  uint8ArgsList, // savingSharePercentageList,feeSelectionList
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
            uint j = (i + ringSize - 1) % ringSize;

            address ownerAddress = validateOrderOwnerSignatureForAddress();

            var order = Order(
                address(this),
                tokenSList[i],
                tokenSList[j],
                uintArgsList[i][0],
                uintArgsList[i][1],
                uintArgsList[i][2],
                uintArgsList[i][3],
                uintArgsList[i][4],
                uint8ArgsList[i][0],
                buyNoMoreThanAmountBList[i],
                vList[i],
                rList[i],
                sList[i]);

            validateOrder(order);

            orders[i] = OrderState(
                order, 
                getOrderHash(order),
                ownerAddress,
                uint8ArgsList[i][1],  // feeSelectionList
                uintArgsList[i][5],   // rateAmountS
                getSpendable(order.tokenS, ownerAddress),
                0,   // fillAmountS, to be initialized to amountS after scaling.
                0,   // lrcReward, to be calculated.
                0,   // lrcFee, to be calculated.
                0    // feeS, to be calculated.
                );

            require(orders[i].availableAmountS > 0);
        }

        return orders;
    }

    function validateOrder(Order order) internal constant {
        require(order.tokenS != address(0));
        require(order.tokenB != address(0));
        require(order.amountS > 0);
        require(order.amountB > 0);
        require(order.expiration >= block.number);
        require(order.rand > 0);
        require(order.savingSharePercentage >= 0);
        require(order.savingSharePercentage <= SAVING_SHARE_PERCENTAGE_BASE);
    }

    function validateMinerSignatureForAddress()
        internal
        constant
        returns (address addr) {

        return address(0);
    }

    function validateOrderOwnerSignatureForAddress(
        ) internal constant returns (address addr) {

        return address(0);
    }

   /// @dev Calculates Keccak-256 hash of order with specified parameters.
   /// @return Keccak-256 hash of order.
   function getOrderHash(Order order)
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
            order.savingSharePercentage,
            order.buyNoMoreThanAmountB);
   }

    /// @dev            Verifies that an order signature is valid.
    ///                 For how validation works, See https://ethereum.stackexchange.com/questions/1777/workflow-on-signing-a-string-with-private-key-followed-by-signature-verificatio
    ///                 For keccak256 prefix, See https://ethereum.stackexchange.com/questions/19582/does-ecrecover-in-solidity-expects-the-x19ethereum-signed-message-n-prefix
    /// @param signer   address of signer.
    /// @param hash     Signed Keccak-256 hash.
    /// @param v        ECDSA signature parameter v.
    /// @param r        ECDSA signature parameters r.
    /// @param s        ECDSA signature parameters s.
    /// @return         Validity of order signature.
    function isSignatureValid(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
        constant
        returns (bool) {

        return signer == ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }

}