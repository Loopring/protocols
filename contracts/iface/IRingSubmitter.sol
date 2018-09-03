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


/// @title IRingSubmitter
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IRingSubmitter {
    uint16  public constant FEE_AND_TAX_PERCENTAGE_BASE = 1000;

    // Tax rates
    uint16 public constant TAX_MATCHING_CONSUMER_LRC    =    10;
    uint16 public constant TAX_MATCHING_CONSUMER_ETH    =   500;
    uint16 public constant TAX_MATCHING_CONSUMER_OTHER  =  1000;
    uint16 public constant TAX_MATCHING_INCOME_LRC      =    10;
    uint16 public constant TAX_MATCHING_INCOME_ETH      =   100;
    uint16 public constant TAX_MATCHING_INCOME_OTHER    =   200;
    uint16 public constant TAX_P2P_CONSUMER_LRC         =    10;
    uint16 public constant TAX_P2P_CONSUMER_ETH         =    20;
    uint16 public constant TAX_P2P_CONSUMER_OTHER       =    20;
    uint16 public constant TAX_P2P_INCOME_LRC           =     0;
    uint16 public constant TAX_P2P_INCOME_ETH           =     0;
    uint16 public constant TAX_P2P_INCOME_OTHER         =     0;

    struct Fill {
        bytes32     orderHash;
        address     owner;
        address     tokenS;
        uint        amountS;
        uint        split;  // splitS
        uint        feeAmount;
    }

    event RingMined(
        uint            _ringIndex,
        address indexed _broker,        // TODO: broker is different for every order
        address indexed _feeRecipient,
        Fill[]          _fills
    );

    event InvalidRing(
        bytes32 ringHash
    );

    /// @dev Submit a order-ring for validation and settlement.
    function submitRings(
        bytes data
        )
        external;
}
