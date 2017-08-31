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
    /// @param feeSelection A miner-supplied value indicating if LRC or saving
    ///                     share is choosen by the miner.
    /// @param fillAmountS  This value is initially provided by miner and later
    ///                     will be updated by protocol based on order state.
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
        uint    fillAmountS;            
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
        string  indexed _orderId, // TODO: what should this be
        uint    _amountS,
        uint    _amountB,
        uint    _lrcReward,
        uint    _lrcFee,
        uint    _feeS,
        uint    _feeB);

    /// Constructor
    function LoopringProtocol(
        address _owner,
        uint    _maxRingSize,
        uint    _defaultDustThreshold,
        uint    _expirationAsBlockHeightThreshold
        ) public {

        require(_owner != address(0));
        require(_maxRingSize >= 2);
        require(_defaultDustThreshold >= 0);
        require(_expirationAsBlockHeightThreshold > block.number * 100);

        owner                            = _owner;
        maxRingSize                      = _maxRingSize;
        defaultDustThreshold             = _defaultDustThreshold;
        expirationAsBlockHeightThreshold = _expirationAsBlockHeightThreshold;
    }

    function submitRing(
        address     feeRecepient,
        bool        throwIfTokenAllowanceOrBalanceIsInsuffcient,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,fillAmountS,expiration,rand,lrcFee
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByTokenSDepletedList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        ) {

        // Verify data integrity.
        uint ringSize = tokenSList.length;
        require(ringSize > 1 && ringSize <= maxRingSize);

        var orders = assambleOrders(
            ringSize,
            tokenSList,
            arg1List, // amountS,AmountB,fillAmountS,expiration,rand,lrcFee
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
        uint i;

        checkRingMatchingRate(ring);


        ring = updateRing(ring);

        // Check there is no dust order in this ring.
        for (i = 0; i < ringSize; i++) {
            require(!isDustOrder(orders[i]));
        }
    }


    function checkRingMatchingRate(
        Ring _ring
        ) internal constant {


    }

    function scale(
        uint xx,
        uint y,
        uint x
        ) internal constant returns (uint yy) {
        require(xx > 0 && y > 0 && x > 0);
        yy = xx.mul(y).div(x);
        require(yy > 0);
    }


    function updateRing(Ring ring) internal constant returns (Ring) {
        for (uint i = 0; i < ring.orders.length; i++) {
            var state = ring.orders[i];
            var order = state.order;

            // Scale orders based on their fill hisotry, cancellation history,
            // ERC20 balance and allowance.
            uint availableS = getSpendable(order.tokenS, state.owner);
            uint availableB = getSpendable(order.tokenB, state.owner);

            uint originalAmountS = order.amountS;
            uint originalAmountB = order.amountB;

            if (order.isCompleteFillMeasuredByTokenSDepleted) {
                order.amountS -= cancelledS[state.orderHash];
                order.amountS -= filledS[state.orderHash];

                order.amountB = scale(
                    order.amountS.min256(availableS),
                    originalAmountB,
                    originalAmountS);

                order.amountS = scale(
                    order.amountB.min256(availableB),
                    originalAmountS,
                    originalAmountB);

            } else {
                order.amountB -= cancelledB[state.orderHash];
                order.amountB -= filledB[state.orderHash];

                order.amountS = scale(
                    order.amountB.min256(availableB),
                    originalAmountS,
                    originalAmountB);

                order.amountB = scale(
                    order.amountS.min256(availableS),
                    originalAmountB,
                    originalAmountS);
            }
        }
        return ring;
    }

  

    /// TODO(daniel): For each token, a dust threshold should be maintained by
    /// a TokenRegistry contract. 
    function isDustOrder(
        OrderState orderState
        ) internal constant returns (bool isDust) {

        if (orderState.order.amountS < defaultDustThreshold) return true;
        if (orderState.order.amountB < defaultDustThreshold) return true;
    }

    function getSpendable(
        address _tokenAddress,
        address _owner
        ) internal constant returns (uint) {

        var token = ERC20(_tokenAddress);
        return token
            .allowance(_owner, address(this))
            .min256(token.balanceOf(_owner));
    }


    function assambleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,expiration,rand,lrcFee,fillAmountS
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByTokenSDepletedList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        ) internal constant returns (OrderState[]) {

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
                arg1List[i][5],  // fillAmountS
                0,  // lrcReward
                0,  // lrcFee
                0,  // feeSForThisOrder
                0   // feeSForNextOrder
                );
        }

        return orders;
    }

    function validateMinerSignatureForAddress(
        ) internal constant returns (address addr) {

        return address(0);
    }

    function validateOrderOwnerSignatureForAddress(
        ) internal constant returns (address addr) {

        return address(0);
    }

    function getOrderHash(Order orde) internal returns (bytes32) {

    }

    /// @dev            Verifies that an order signature is valid.
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