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

import "./IManagingTokens.sol";


/// @title IManagingDeposits
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract IManagingDeposits is IManagingTokens
{
    // Returns the index of the first onchain request that wasn't committed in a block yet.
    // This can be used by operator contracts to have additional logic for onchain requests
    // (more strict deadlines, ...)
    function getFirstUnprocessedDepositRequestIndex()
        public
        view
        returns (uint);

    function getNumAvailableDepositSlots()
        public
        view
        returns (uint);

    function getDepositRequest(
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32  timestamp
        );

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        payable
        returns (uint24 accountID);

    function deposit(
        address token,
        uint96  amount
        )
        external
        payable;

    function depositTo(
        address recipient,
        address token,
        uint96  amount
        )
        public
        payable;
}