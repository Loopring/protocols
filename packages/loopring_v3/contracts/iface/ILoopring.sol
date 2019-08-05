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
pragma solidity 0.5.10;

/// @title ILoopring
/// @author Daniel Wang  - <daniel@loopring.org>
contract ILoopring
{
    /// @dev Initialize and register an exchange.
    ///      Note that this function can only be called one per deployed exchange instance.
    /// @param  exchangeAddress The address of the exchange to initialize and register.
    /// @param  owner The owner of the exchange.
    /// @param  operator The operator address of the exchange who will be responsible for
    ///         submitting blocks and proofs.
    /// @param  onchainDataAvailability True if "Data Availability" is turned on for this
    ///         exchange. Note that this value can not be changed once the exchange is created.
    /// @return exchangeId The id of the exchange.
    function registerExchange(
        address exchangeAddress,
        address owner,
        address payable operator,
        bool onchainDataAvailability
        )
        external
        returns (uint exchangeId);
}