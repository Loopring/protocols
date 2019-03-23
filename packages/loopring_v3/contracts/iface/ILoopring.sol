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
pragma solidity 0.5.2;


/// @title ILoopring
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ILoopring
{
    event ExchangeCreated(
        uint    exchanegId,
        address exchangeAddress,
        address exchangeOwnerContractAddress,
        address creator,
        uint    lrcBurned
    );

    address[] public exchanges;

    address public lrcAddress = address(0);

    uint public dexCreationCostLRC              = 0 ether;
    uint public dexCreationIncrementalCostLRC   = 0 ether;
    uint public dexStakedLRCPerFailure          = 0 ether;

    function updateSettings(
        address _lrcAddress,
        uint _dexCreationCostLRC,
        uint _dexCreationIncrementalCostLRC,
        uint _dexStakedLRCPerFailure
        )
        external;

    function createExchange(
        address _exchangeOwnerContractAddress,
        uint32  _numFailuresAllowed
        )
        external
        returns (uint exchangeId, address exchangeAddress);
}
