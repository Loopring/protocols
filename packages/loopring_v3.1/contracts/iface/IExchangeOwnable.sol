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

import "./IExchangeV3.sol";


/// @title  IExchangeOwnable
/// @author Brecht Devos - <brecht@loopring.org>
contract IExchangeOwnable
{
    IExchangeV3 public exchange;

    modifier onlyExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }
}
