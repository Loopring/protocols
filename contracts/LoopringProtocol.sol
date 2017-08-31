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
    uint    public   ringIndex = 0;

    struct Ring {
        address  miner;
        Order[] orders;
    }

    struct Order {
        address owner;
        address tokenS;                         // token to sell
        address tokenB;                         // token to buy
        uint    amountS;
        uint    amountB;
        uint    feeLRC;                         // LRC amount as fee
        uint    percentageSavingShare;          // Percentage of saving sare
        uint    expiration;                     // If this value < X (TBD), treat it as block height;
                                                // otherwise treat it as seconds since epoch.
        uint    rand;                           // a random number
        bool    isCompleteFillMeasuredByAllSellTokenBeenSpent;
        // Signature fields
        bytes32 orderHash;
        uint8   v;
        bytes32 r;
        bytes32 s;
    }

    struct OrderState {
        Order   order;
        uint    fillAmountS;    // provided by ring-miner, verified by protocol
        uint    feeSelection;   // provided by ring-miner
        address owner;          // calculated by protocol
        uint    netfeeLRC;      // calculated by protocol
        uint    netfeeS;        // calculated by protocol
        uint    netfeeB;        // calculated by protocol
    }

    event RingMined(
        address indexed miner,
        address indexed feeRecepient,
        uint    ringIndex);

    event OrderFilled(
        uint     ringIndex,
        bytes32  orderHash,
        uint     amountS,
        uint     amountB,
        uint     feeLRC,
        uint     feeS,
        uint     feeB);

    /// Constructor
    function LoopringProtocol() public {
        /* require(_owner != address(0)); */
        /* owner = _owner; */
    }

    function submitRing(
        address     feeRecepient,
        bool        throwIfTokenAllowanceOrBalanceIsInsuffcient,
        address[]   orderOwnerList,
        address[]   tokenSList,
        uint[8][]   orderValueList, // amountS,AmountB,fillAmountS,lrcFee,percentageSavingShare,feeSelection,expiration,rand
        bool[]      isCompleteFillMeasuredByAllSellTokenBeenSpentList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList) {
        // Verify data integrity.
        uint ringSize = tokenSList.length;
        require(ringSize > 1 && ringSize <= MAX_RING_SIZE);
        var orderStates = assambleOrders(
            ringSize,
            orderOwnerList,
            tokenSList,
            orderValuesList,
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
        address[]   orderOwnerList,
        address[]   tokenSList,
        uint[8][]   orderValueList, // amountS,AmountB,fillAmountS,lrcFee,percentageSavingShare,feeSelection,expiration,rand
        bool[]      isCompleteFillMeasuredByAllSellTokenBeenSpentList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        internal
        constant
        returns (OrderState[])
    {
        require(ringSize == orderOwnerList.length);
        require(ringSize == tokenSList.length);
        require(ringSize == orderValueList.length);
        require(ringSize == isCompleteFillMeasuredByAllSellTokenBeenSpentList.length);
        require(ringSize + 1 == vList.length);
        require(ringSize + 1 == rList.length);
        require(ringSize + 1 == sList.length);

        var orders = new OrderState[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            uint j = (i + ringSize - 1) % ringSize;

            var order = Order(
                orderOwnerList[i],
                tokenSList[i],
                tokenSList[j],
                orderValueList[i][0],
                orderValueList[i][1],
                orderValueList[i][3],
                orderValueList[i][4],
                orderValueList[i][6],
                orderValueList[i][7],
                isCompleteFillMeasuredByAllSellTokenBeenSpentList[i],
                '',
                vList[i],
                rList[i],
                sList[i]);
            order.orderHash = getOrderHash(order);
            require(isValidSignature(order.owner, order.orderHash, order.v, order.r, order.s));

            orders[i] = OrderState(
                order,
                orderValueList[i][2],
                orderValueList[i][5],
                order.owner,
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
    /// For how validation works, See https://ethereum.stackexchange.com/questions/1777/workflow-on-signing-a-string-with-private-key-followed-by-signature-verificatio
    /// For keccak256 prefix, See https://ethereum.stackexchange.com/questions/19582/does-ecrecover-in-solidity-expects-the-x19ethereum-signed-message-n-prefix
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

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @return Keccak-256 hash of order.
    function getOrderHash(Order order)
        internal
        constant
        returns (bytes32)
    {
        return keccak256(
            address(this),
            order.owner,
            order.tokenS,
            order.tokenB,
            order.amountS,
            order.amountB,
            order.feeLRC,
            order.percentageSavingShare,
            order.expiration,
            order.rand
        );
    }

}
