

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

import "../lib/Ownable.sol";


interface Module
{
    function initialize(address wallet) external;

    // The following methods should be only callable by wallet's owners.
    function addModule(address wallet, address module) external;
    function removeModule(address wallet, address module) external;

    function addFunction(address wallet, bytes4 func, address module) external;
    function delFunction(address wallet, bytes4 func) external;
}