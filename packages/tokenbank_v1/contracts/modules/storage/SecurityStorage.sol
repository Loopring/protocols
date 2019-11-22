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

import "../../base/BaseStorage.sol";

import "./SecurityCell.sol";


/// @title SecurityStorage
/// @dev TODO
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityStorage is BaseStorage
{
    mapping (address => address) public cells;

    constructor(address manager)
        public
        BaseStorage(manager)
    {}

    function isGuardian(address wallet, address guardian)
        public
        view
        returns (bool)
    {
        address cell= cells[wallet];
        if (cell == address(0)) return false;
        else return SecurityCell(cell).isGuardian(guardian);
    }

    function getLock(address wallet)
        public
        view
        returns (uint)
    {
        address cell= cells[wallet];
        if (cell == address(0)) return 0;
        else return SecurityCell(cell).lock();
    }

    function setLock(address wallet, uint lock)
        external
        returns (uint)
    {
        address cell= cells[wallet];
        if (cell == address(0)) {
            cell = address(new SecurityCell());
            cells[wallet] = cell;
        }
        SecurityCell(cell).setLock(lock);
    }
}