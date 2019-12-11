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
pragma solidity ^0.5.13;


/// @title DAppRegistry
/// @dev A registry for DApps.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract DAppRegistry
{
    function enableDApp(address dapp) external;
    function disableDApp(address dapp) external;
    function isDAppEnabled(address dapp) public view returns (bool);
    function dapps() public view returns (address[] memory _dapps);
    function numOfDApps() public view returns (uint);
}