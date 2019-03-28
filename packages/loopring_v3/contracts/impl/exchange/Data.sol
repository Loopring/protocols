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

import "../../iface/exchange/IData.sol";

import "../../iface/ILoopringV3.sol";

import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";
import "../../lib/Ownable.sol";


/// @title An Implementation of IData.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Data is IData, Ownable, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    ILoopringV3 internal loopring;

    modifier onlyOperator()
    {
        require(msg.sender == operator, "UNAUTHORIZED");
        _;
    }
}