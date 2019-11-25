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

import "../../lib/MathUint.sol";

import "../../base/DataStore.sol";


/// @title WhitelistStore
/// @dev This store maintains a wallet's whitelisted addresses.
contract ReimbursementStore is DataStore
{
    using MathUint for uint;

    event LimitUpdated (uint limit);
    event Reimbursement(
        address indexed payer,
        address indexed payee,
        uint            amount
    );

    uint public limit;

    // payer -> user -> amount
    mapping (address => mapping(address => uint)) public history;

    constructor(uint _limit) public DataStore()
    {
        limit = _limit;
    }

    function setLimit(uint _limit)
        external
        onlyOwner
    {
        limit = _limit;
        emit LimitUpdated(limit);
    }

    function checkAndUpdate(
        address payee,
        uint    amount
        )
        external
    {
        if (payee == msg.sender) return;

        uint total = history[msg.sender][payee].add(amount);
        require(total <= limit, "TOO_MUCH");
        history[msg.sender][payee] = total;
        emit Reimbursement(msg.sender, payee, amount);
    }
}
