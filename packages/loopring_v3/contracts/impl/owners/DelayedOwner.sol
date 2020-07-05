// SPDX-License-Identifier: Apache-2.0
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
pragma solidity ^0.6.10;

import "../../lib/Claimable.sol";

import "../../impl/DelayedTransaction.sol";


/// @title  DelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract DelayedOwner is DelayedTransaction, Claimable
{
    address public defaultContract;

    constructor(
        address _defaultContract,
        uint    _timeToLive
        )
        DelayedTransaction(_timeToLive)
        public
    {
        defaultContract = _defaultContract;
    }

    receive()
        external
        // nonReentrant
        payable
    {
        // Don't do anything when receiving ETH
    }

    fallback()
        external
        nonReentrant
        payable
    {
        // Don't do anything if msg.sender isn't the owner
        if (msg.sender != owner) {
            return;
        }
        transactInternal(defaultContract, msg.value, msg.data);
    }

    function isAuthorizedForTransactions(address sender)
        internal
        override
        view
        returns (bool)
    {
        return sender == owner;
    }

    function setFunctionDelay(
        bytes4  functionSelector,
        uint    delay
        )
        internal
    {
        setFunctionDelay(defaultContract, functionSelector, delay);
    }
}
