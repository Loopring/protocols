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

import "../iface/IDEX.sol";

import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>,
contract DEX is IDEX, NoDefaultFunc
{

    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    constructor(
        uint    _id,
        address _loopring,
        address _ownerContractAddress,
        address _creator,
        address _lrcAddress,
        uint    _stakedLRCPerFailure,
        uint32  _numOfFailuresAllowed
        )
        public
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopring, "ZERO_ADDRESS");
        require(address(0) != _ownerContractAddress, "ZERO_ADDRESS");
        require(address(0) != _creator, "ZERO_ADDRESS");
        require(0 != _stakedLRCPerFailure, "ZERO_VALUE");
        require(0 != _numOfFailuresAllowed, "ZERO_VALUE");

        id = _id;
        loopring = _loopring;
        ownerContractAddress = _ownerContractAddress;
        creator = _creator;
        lrcAddress = _lrcAddress;

        stakedLRCPerFailure = _stakedLRCPerFailure;
        numOfFailuresAllowed = _numOfFailuresAllowed;

        uint stakedLRCAmount = stakedLRCPerFailure.mul(numOfFailuresAllowed);

        require(
            lrcAddress.safeTransferFrom(
                creator,
                address(this),
                stakedLRCAmount
            ),
            "INSUFFICIENT_FUND"
        );

        emit LRCStaked(id, stakedLRCAmount);
    }
}