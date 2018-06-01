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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/IBrokerRegistry.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/ITokenRegistry.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/IMinerRegistry.sol";


library Data {

    struct Inputs {
        address[] addressList;
        uint[] uintList;
        bytes[] bytesList;
        uint i;
        uint j;
        uint k;
    }

    struct Context {
        address lrcTokenAddress;
        ITokenRegistry  tokenRegistry;
        ITradeDelegate  delegate;
        IBrokerRegistry orderBrokerRegistry;
        IBrokerRegistry minerBrokerRegistry;
        IOrderRegistry  orderRegistry;
        IMinerRegistry  minerRegistry;
    }

    struct Mining {
        // required fields
        address feeRecipient;

        // optional fields
        address miner;
        bytes   sig;

        // computed fields
        bytes32 hash;
        address interceptor;
        uint    spendableLRC;
    }

    struct Order {
        // required fields
        address owner;
        address tokenS;
        address tokenB;
        uint    amountS;
        uint    amountB;
        uint    lrcFee;

        // optional fields
        address dualAuthAddr;
        address broker;
        address orderInterceptor;
        address wallet;
        uint    validSince;
        uint    validUntil;
        bytes   sig;
        bytes   dualAuthSig;
        bool    limitByAmountB;
        bool    allOrNone;

        // computed fields
        bytes32 hash;
        address brokerInterceptor;
        uint    maxAmountLrcFee;
        uint    maxAmountS;
        uint    maxAmountB;
        bool    sellLRC;
    }

    struct Participation {
        // required fields
        Order order;
        bool marginSplitAsFee;
        uint rateS;
        uint rateB;

        // computed fields
        uint splitS;
        uint splitB;
        uint lrcFee;
        uint lrcReward;
        uint fillAmountS;
        uint fillAmountB;
    }

    struct Ring{
        uint size;
        Participation[] participations;
        bytes32 hash;
    }
}