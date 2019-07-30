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
pragma solidity 0.5.10;

import "../../lib/Claimable.sol";

import "./IBlockProcessor.sol";


/// @title BaseBlockProcessor
/// @author Daniel Wang - <daniel@loopring.org>
contract BaseBlockProcessor is IBlockProcessor, Claimable
{
    bool public supportOnChainDataAvailability;
    ExchangeData.State internal state;

    // TODO(daniel): added management Circuit code

    struct Circuit
    {
        bool registered;
        bool enabled;
        uint[18] verificationKey;
    }

    mapping (uint16 => mapping (uint8 => mapping (bool => Circuit))) public circuits;

    function getVerificationKey(
        uint16 size,
        uint8  version,
        bool   onChainDataAvailability
        )
        external
        view
        returns (uint[18] memory)
    {
       bool da = supportOnChainDataAvailability ? onChainDataAvailability : false;
       Circuit storage circuit = circuits[size][version][da];
       require(circuit.enabled, "INVALID_CIRCUIT");
       return circuit.verificationKey;
    }
}


