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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";


contract Migrations {
    address public owner;
    uint public last_completed_migration;

    modifier restricted()
    {
        if (msg.sender == owner) {
            _;
        }
    }

    constructor()
        public
    {
        owner = msg.sender;
    }

    function setCompleted(uint completed)
        restricted
        public
    {
        last_completed_migration = completed;
    }

    function upgrade(address newAddress)
        restricted
        public
    {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(last_completed_migration);
    }
}
