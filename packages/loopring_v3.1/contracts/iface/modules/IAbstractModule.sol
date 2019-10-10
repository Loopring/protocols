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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../IExchangeModule.sol";

import "../../iface/IExchangeV3.sol";


/// @title  IAbstractModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IAbstractModule is IExchangeModule
{
    IExchangeV3 public exchange;
    ILoopringV3 public loopring;

    uint32 public exchangeId;
    bool   public onchainDataAvailability;

    IVerificationKeyProvider public vkProvider;

    function commitBlock(
        uint32 blockSize,
        uint16 blockVersion,
        bytes  calldata data,
        bytes  calldata offchainData
        )
        external;
}
