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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


abstract contract QuotaManager
{
    /// @dev Check and update quota for spending the additional amount
    ///      if withing quota.
    /// @return True if the amount is within quota and the spent amount
    ///         was updated, else false.
    function hasEnoughQuota(
        address wallet,
        uint    requiredAmount
        )
        public
        view
        virtual
        returns (bool);

    /// @dev Check and update quota for spending the additional amount.
    ///      Must revert in case of error.
    function checkAndAddToSpent(
        address wallet,
        uint    amount
        )
        external
        virtual;
}