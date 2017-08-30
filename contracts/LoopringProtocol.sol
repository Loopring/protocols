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

/// @title Loopring Token Exchange Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>, Daniel Wang - <daniel@loopring.org>.
contract LoopringProtocol {

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
        uint    fillAmountS;
        uint8   feeSelection;
        uint    netfeeLRC;
        uint    netfeeS;
        uint    netfeeB;
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
        var orders = assambleOrders(
            ringSize,
            tokenSList,
            arg1List, // amountS,AmountB,fillAmountS,expiration,rand,lrcFee
            arg2List, // percentageSavingShareList,feeSelectionList
            isCompleteFillMeasuredByAllSellTokenBeenSpentList,
            vList,
            rList,
            sList);
  

        // RingFilled(miner, loopringId++);
    }

    function assambleOrders(
        uint        ringSize,
        address[]   tokenSList,
        uint[6][]   arg1List, // amountS,AmountB,expiration,rand,lrcFee,fillAmountS
        uint8[2][]  arg2List, // percentageSavingShareList,feeSelectionList
        bool[]      isCompleteFillMeasuredByAllSellTokenBeenSpentList,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList) internal constant returns (OrderState[]) {

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
