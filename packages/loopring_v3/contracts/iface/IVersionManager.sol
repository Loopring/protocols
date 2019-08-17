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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IVersionManager
/// @dev This contract manages implementation versions for a perticular ILoopring
///      contract. The ILoopring contract can be considered as the "major" version
///      and each IExchange implementation can be considiered as the "minor" version.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IVersionManager is Claimable, ReentrancyGuard
{
    // --- Events ---

    event DefaultChanged(
        address oldDefault,
        address newDefault
    );

    event ImplementationAdded   (address implementation, string version);
    event ImplementationEnabled (address implementation);
    event ImplementationDisabled(address implementation);

    // --- Public Data ---

    address   public protocol;
    address   public defaultImplementation;
    address[] public implementations;
    mapping   (string => address) public versionLabelMap;


    // --- Functions ---

    function protocolVersion()
        external
        view
        returns (string memory version);

    function setDeaultImplementation(
        address implementation
        )
        external;

    function enableImplementation(
        address implementation
        )
        external;

    function disableImplementation(
        address implementation
        )
        external;

    function latestImplementation()
        public
        view
        returns (address);

    function addImplementation(
        address implementation
        )
        public;

    function isImplementationRegistered(
        address implementation
        )
        public
        view
        returns (bool);

    function isImplementationEnabled(
        address implementation
        )
        public
        view
        returns (bool);
}