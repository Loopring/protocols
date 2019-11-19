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

import "./Wallet.sol";


/// @title Module
/// @dev Base contract for all smart wallet modules.
///      Each module must implement the `init` method. It will be called when
///      the module is added to the given wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
interface Module
{
    /// @dev Initializes the module for the given wallet when the module is added.
    ///      This function must throw in case of error.
    ///      Warning: this method can ONLY be called by a wallet.
    function initialize(address wallet) external;

    /// @dev Terminate the module for the given wallet when the module is removed.
    ///      This function must throw in case of error.
    ///      Warning: this method can ONLY be called by a wallet.
    function terminate(address walelt) external;
}