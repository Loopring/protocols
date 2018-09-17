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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/IBrokerRegistry.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/IMinerRegistry.sol";
import "../iface/IFeeHolder.sol";
import "../iface/IOrderBook.sol";
import "../iface/ITaxTable.sol";


library Data {

    struct Inputs {
        bytes data;
        Spendable[] spendableList;
        uint bytesOffset;
        uint16 miningSpec;
        uint numOrders;
        uint ordersOffset;
        uint numRings;
        uint ringsOffset;
    }

    // Update TaxHelper.getTaxRate() if you change the order of these parameters
    struct Tax {
        uint16 matchingIncomeLRC;
        uint16 matchingIncomeETH;
        uint16 matchingIncomeOther;
        uint16 p2pIncomeLRC;
        uint16 p2pIncomeETH;
        uint16 p2pIncomeOther;
        uint16 percentageBase;
        address lrcTokenAddress;
        address wethTokenAddress;
    }

    struct Context {
        address lrcTokenAddress;
        ITradeDelegate  delegate;
        IBrokerRegistry orderBrokerRegistry;
        IBrokerRegistry minerBrokerRegistry;
        IOrderRegistry  orderRegistry;
        IMinerRegistry  minerRegistry;
        IFeeHolder feeHolder;
        IOrderBook orderBook;
        ITaxTable taxTable;
        uint64 ringIndex;
        uint feePercentageBase;
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
    }

    struct Spendable {
        bool initialized;
        uint amount;
        uint reserved;
    }

    struct Order {
        // required fields
        address   owner;
        address   tokenS;
        address   tokenB;
        uint      amountS;
        uint      amountB;
        uint      validSince;
        Spendable tokenSpendableS;
        Spendable tokenSpendableFee;

        // optional fields
        address   dualAuthAddr;
        address   broker;
        Spendable brokerSpendableS;
        Spendable brokerSpendableFee;
        address   orderInterceptor;
        address   wallet;
        uint      validUntil;
        bytes     sig;
        bytes     dualAuthSig;
        bool      allOrNone;
        address   feeToken;
        uint      feeAmount;
        uint16    feePercentage;         // Post-trading
        int16     waiveFeePercentage;
        uint16    tokenSFeePercentage;    // Pre-trading
        uint16    tokenBFeePercentage;   // Post-trading
        address   tokenRecipient;
        uint16    walletSplitPercentage;

        // computed fields
        bool    P2P;
        bytes32 hash;
        address brokerInterceptor;
        uint    filledAmountS;
        bool    valid;
    }

    struct Participation {
        // required fields
        Order order;

        // computed fields
        uint splitS;
        uint feeAmount;
        uint feeAmountS;
        uint feeAmountB;
        uint rebateFee;
        uint rebateS;
        uint rebateB;
        uint fillAmountS;
        uint fillAmountB;
    }

    struct Ring{
        uint size;
        Participation[] participations;
        bytes32 hash;
        uint minerFeesToOrdersPercentage;
        bool valid;
    }

    struct FeeContext {
        bytes32[] data;
        uint offset;
        Data.Ring ring;
        Data.Context ctx;
        Data.Mining mining;
        Data.Order order;
        uint walletPercentage;
    }
}
