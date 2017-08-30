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
/// @author Kongliang Zhong - <kongliang@loopring.org>, Daniel Wang - <daniel@loopring.org>.
contract LoopringProtocol {
    using SafeMath for uint;
    using Math for uint;

    uint    public constant MAX_RING_SIZE = 5;
    address public   owner;
    uint    public   ringIndex = 0;

    struct Ring {
        string  miner;
        Order[] orders;
    }

    struct Order {
        address tokenS;                         // token to sell
        address tokenB;                         // token to buy
        uint    amountS;
        uint    amountB;
        uint    expiration;                     // If this value < X (TBD), treat it as block height;
                                                // otherwise treat it as seconds since epoch.
        uint    rand;                           // a random number
        uint    feeLRC;                         // LRC amount as fee
        uint8   percentageSavingShare;          // Percentage of saving sare
        bool    isCompleteFillMeasuredByAllSellTokenBeenSpent;
        // Signature fields
        uint8   v;
        bytes32 r;
        bytes32 s;
    }

    struct OrderState {
        Order   order;
        uint    fillAmountS;    // provided by ring-miner, verified by protocol
        uint8   feeSelection;   // provided by ring-miner
        address owner;          // calculated by protocol
        uint    netfeeLRC;      // calculated by protocol
        uint    netfeeS;        // calculated by protocol
        uint    netfeeB;        // calculated by protocol
    }

    event RingMined(
        address indexed miner,
        address indexed feeRecepient,
        uint    indexed ringIndex);

    event OrderFilled(
        uint    indexed ringIndex,
        string  indexed orderId, // TODO: what should this be
        uint    amountS,
        uint    amountB,
        uint    feeLRC,
        uint    feeS,
        uint    feeB);

    /// Constructor
    function LoopringProtocol(address _owner) public {
        require(_owner != address(0));
        owner = _owner;
    }

    function submitRing(
        address     feeRecepient,
        bool        throwIfTokenAllowanceOrBalanceIsInsuffcient,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,fillAmountS,expiration,rand,lrcFee
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByAllSellTokenBeenSpentList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList) {

        // Verify data integrity.
        uint ringSize = tokenSList.length;
        require(ringSize > 1 && ringSize <= MAX_RING_SIZE);
        var orderStates = assambleOrders(
            ringSize,
            tokenSList,
            arg1List, // amountS,AmountB,fillAmountS,expiration,rand,lrcFee
            arg2List, // percentageSavingShareList,feeSelectionList
            isCompleteFillMeasuredByAllSellTokenBeenSpentList,
            vList,
            rList,
            sList);

        orderStates = getUpdateOrders(ringSize, orderStates);
  

        // RingFilled(miner, loopringId++);
    }

    function getUpdateOrders(
        uint ringSize,
        OrderState[] orderStates
        ) internal constant returns (OrderState[] newOrderStates) {

        newOrderStates = new OrderState[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            newOrderStates[i] = getUpdatedOrder(orderStates[i]);
        }
    }

    function getUpdatedOrder(
        OrderState orderState
        ) internal constant returns (OrderState newOrderState) {

        newOrderState = orderState;

        require(orderState.fillAmountS > 0);
        var order = newOrderState.order;

        // TODO(daniel): verify signature and calculate owner address
        newOrderState.owner = address(0);

        uint spendableS = getSpendable(order.tokenS, newOrderState.owner);

        require(spendableS >= newOrderState.fillAmountS);
    }

    function getSpendable(
        address tokenAddress,
        address owner
        ) internal constant returns (uint) {

        var token = ERC20(tokenAddress);
        return token
            .allowance(owner, address(this))
            .min256(token.balanceOf(owner));
    }


    function assambleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,expiration,rand,lrcFee,fillAmountS
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByAllSellTokenBeenSpentList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        ) internal constant returns (OrderState[]) {

        require(ringSize == tokenSList.length);
        require(ringSize == arg1List.length);
        require(ringSize == arg2List.length);
        require(ringSize == isCompleteFillMeasuredByAllSellTokenBeenSpentList.length);
        require(ringSize + 1 == vList.length);
        require(ringSize + 1 == rList.length);
        require(ringSize + 1 == sList.length);


        var orders = new OrderState[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            uint j = (i + ringSize- 1) % ringSize;

            var order = Order(
                tokenSList[i],
                tokenSList[j],
                arg1List[i][0],
                arg1List[i][1],
                arg1List[i][2],
                arg1List[i][3],
                arg1List[i][4],
                arg2List[i][0],
                isCompleteFillMeasuredByAllSellTokenBeenSpentList[i],
                vList[i],
                rList[i],
                sList[i]);

            orders[i] = OrderState(
                order, 
                arg1List[i][5],
                arg2List[i][1],
                address(0),
                0,
                0,
                0);
        }

        return orders;
    }

    /// @dev Verifies that an order signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Validity of order signature.
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
