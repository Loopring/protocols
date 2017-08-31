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

/// @title Loopring Token Exchange Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract LoopringProtocol {
    using SafeMath for uint;
    using Math for uint;

    uint    public constant FEE_SELECT_LRC          = 0;
    uint    public constant FEE_SELECT_SAVING_SHARE = 1;

    address public  lrcTokenAddress                  = address(0);
    address public  owner                            = address(0);
    uint    public  maxRingSize                      = 0;
    uint    public  defaultDustThreshold             = 0;
    uint    public  expirationAsBlockHeightThreshold = 0;
    uint    public  ringIndex                        = 0;

    /// The following two maps are used to keep order fill and cancellation
    /// historical records for orders whose isCompleteFillMeasuredByTokenSDepleted
    /// value is `true`.
    mapping (bytes32 => uint) public filledS;
    mapping (bytes32 => uint) public cancelledS;

    /// The following two maps are used to keep order fill and cancellation
    /// historical records if orders whose isCompleteFillMeasuredByTokenSDepleted
    /// value is `false`.
    mapping (bytes32 => uint) public filledB;
    mapping (bytes32 => uint) public cancelledB;



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
    /// @param feeLRC       Max amount of LRC to pay for miner. The real amount
    ///                     to pay is proportional to fill amount.
    /// @param percentageSavingShare The percentage of savings paid to miner.
    /// @param isCompleteFillMeasuredByTokenSDepleted If true, this order
    ///        is considered 'fully filled' if amountS is smaller than a
    ///        dust-threshold; if false, this order is considered 'fully filled'
    ///        if amountB is smaller than a dust-threshold. Noted each token may
    ///        have a different dust-threshold. The default dust-threshold is
    ///        specified by defaultDustThreshold.
    struct Order {
        address tokenS;
        address tokenB;
        uint    amountS;
        uint    amountB;
        uint    expiration;
        uint    rand;
        uint    feeLRC;
        uint8   percentageSavingShare;
        bool    isCompleteFillMeasuredByTokenSDepleted;
        uint8   v;
        bytes32 r;
        bytes32 s;
    }

    /// @param order        The order
    /// @param owner        This order owner's address. This value is calculated.
    /// @param feeSelection A miner-supplied value indicating if LRC (value = 0)
    ///                     or saving share is choosen by the miner (value = 1).
    ///                     We may support more fee model in the future.
    /// @param fillAmountS  Amount of tokenS to sell, computed by protocol.
    /// @param fillAmountB  Amount of tokenB to buy, computed by protocol.
    /// @param rateAmountS  This value is initially provided by miner and is
    ///                     calculated by based on the original information of
    ///                     all orders of the order-ring, in other orders, this
    ///                     value is independent of the order's current state.
    ///                     This value and `rateAmountB` can be used to calculate
    ///                     the proposed exchange rate calculated by miner.                    
    /// @param rateAmountB  See `rateAmountS`.
    /// @param lrcReward    The amount of LRC paid by miner to order owner in
    ///                     exchange for sharing-share.
    /// @param lrcFee       The amount of LR paid by order owner to miner.
    /// @param feeSForThisOrder TokenS paid to miner, as the fee of this order,
    ///                         calculated by protocol.
    /// @param feeSForNextOrder TokenS paid to miner, as the fee of next order,
    ///                         calculated by protocol.
    struct OrderState {
        Order   order;
        bytes32 orderHash;
        address owner;
        uint8   feeSelection;
        uint    rateAmountS;
        uint    rateAmountB; 
        uint    availableAmountS;
        uint    availableAmountB;
        uint    fillAmountS;
        uint    fillAmountB;
        uint    lrcReward;
        uint    lrcFee;
        uint    feeSForThisOrder;
        uint    feeSForNextOrder;
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

    /// Constructor
    function LoopringProtocol(
        address _lrcTokenAddress,
        address _owner,
        uint    _maxRingSize,
        uint    _defaultDustThreshold,
        uint    _expirationAsBlockHeightThreshold
        ) public {

        require(address(0) != _lrcTokenAddress);
        require(address(0) != _owner);
        require(_maxRingSize >= 2);
        require(_defaultDustThreshold >= 0);
        require(_expirationAsBlockHeightThreshold > block.number * 100);

        lrcTokenAddress                  = _lrcTokenAddress;
        owner                            = _owner;
        maxRingSize                      = _maxRingSize;
        defaultDustThreshold             = _defaultDustThreshold;
        expirationAsBlockHeightThreshold = _expirationAsBlockHeightThreshold;
    }

    function submitRing(
        address     feeRecepient,
        bool        throwIfTokenAllowanceOrBalanceIsInsuffcient,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,rateAmountS,expiration,rand,lrcFee
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByTokenSDepletedList,
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
            arg1List, // amountS,AmountB,rateAmountS,expiration,rand,lrcFee
            arg2List, // percentageSavingShareList,feeSelectionList
            isCompleteFillMeasuredByTokenSDepletedList,
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


    function checkRingMatchingRate(
        Ring ring
        )
        internal
        constant {


    }

    function calculateRingOrderFees(
        Ring ring
        )
        internal
        constant {

    }

    function calculateRingOrderFillAmount(
        Ring ring
        )
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

        // These seciton is redundant.
        for (i = 0; i < ringSize; i++) {
            var state = ring.orders[i];
            var next = ring.orders[ (i + 1) % ringSize];
            require(state.fillAmountB == next.fillAmountS);
        }
    }

    function calculateOrderFillAmount(
        Ring ring,
        uint orderIndex
        )
        internal
        constant
        returns (uint indexOfSmallerOrder) {

        uint nextIndex = (orderIndex + 1) % ring.orders.length;
        var state = ring.orders[orderIndex];
        var next = ring.orders[nextIndex];

        state.fillAmountS = state.fillAmountS.min256(state.availableAmountS);

        state.fillAmountB  = scale(
            state.fillAmountS,
            state.rateAmountB,
            state.rateAmountS)
            .min256(state.availableAmountB);

        if (!state.order.isCompleteFillMeasuredByTokenSDepleted) {
            state.fillAmountB = state.fillAmountB.min256(state.order.amountB);
        }

        state.fillAmountS  = scale(
            state.fillAmountB,
            state.rateAmountS,
            state.rateAmountB);

        if (state.fillAmountB > next.fillAmountS) {
            indexOfSmallerOrder = nextIndex;
        } else {
            next.fillAmountS = state.fillAmountB;
        }
    }


    function scaleOrdersBasedOnHistory(
        Ring ring
        )
        internal
        constant {

        for (uint i = 0; i < ring.orders.length; i++) {
            var state = ring.orders[i];
            var order = state.order;

            // ERC20 balance, and allowance.
            state.availableAmountS = getSpendable(order.tokenS, state.owner);
            require(state.availableAmountS > 0);

            state.availableAmountB = getSpendable(order.tokenB, state.owner);
            require(state.availableAmountB > 0);

            if (order.isCompleteFillMeasuredByTokenSDepleted) {
                order.amountS -= cancelledS[state.orderHash];
                order.amountS -= filledS[state.orderHash];

                order.amountB = scale(
                    order.amountS,
                    order.amountB,
                    order.amountS);


            } else {
                order.amountB -= cancelledB[state.orderHash];
                order.amountB -= filledB[state.orderHash];

                order.amountS = scale(
                    order.amountB,
                    order.amountS,
                    order.amountB);
            }

            // Initialize fill amounts
            state.fillAmountS = order.amountS;
            state.fillAmountB = order.amountB;
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

    function getLRCSpendable(
        address _owner
        )
        internal
        constant
        returns (uint) {

        return getSpendable(lrcTokenAddress, _owner);
    }

    function assambleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,expiration,rand,lrcFee,rateAmountS
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByTokenSDepletedList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        internal
        constant
        returns (OrderState[]) {

        require(ringSize == tokenSList.length);
        require(ringSize == arg1List.length);
        require(ringSize == arg2List.length);
        require(ringSize == isCompleteFillMeasuredByTokenSDepletedList.length);
        require(ringSize + 1 == vList.length);
        require(ringSize + 1 == rList.length);
        require(ringSize + 1 == sList.length);


        var orders = new OrderState[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            uint j = (i + ringSize- 1) % ringSize;

            address ownerAddress = validateOrderOwnerSignatureForAddress();

            var order = Order(
                tokenSList[i],
                tokenSList[j],
                arg1List[i][0],
                arg1List[i][1],
                arg1List[i][2],
                arg1List[i][3],
                arg1List[i][4],
                arg2List[i][0],
                isCompleteFillMeasuredByTokenSDepletedList[i],
                vList[i],
                rList[i],
                sList[i]);

            orders[i] = OrderState(
                order, 
                getOrderHash(order),
                ownerAddress,
                arg2List[i][1],  // feeSelectionList
                arg1List[i][5],  // rateAmountS
                arg1List[j][5],  // rateAmountB
                0,   // availableAmountS
                0,   // availableAmountB
                0,   // fillAmountS
                0,   // fillAmountB
                0,   // lrcReward
                0,   // lrcFee
                0,   // feeSForThisOrder
                0    // feeSForNextOrder
                );
        }

        return orders;
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
            order.feeLRC,
            order.percentageSavingShare,
            order.isCompleteFillMeasuredByTokenSDepleted);
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