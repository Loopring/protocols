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


/// @title Registry
/// @dev Modules share states by accessing the same storage instance.
///      Using ModuleStorage will achieve better module decoupling.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract BankRegistry is Claimable
{
    event WalletRegistered  (address indexed wallet);
    event ModuleRegistered  (address indexed module);
    event ModuleDeregistered(address indexed module);


    function registerWallet(address wallet) external;
    function isWallet(address addr) external view returns (bool);
    function numOfWallets() external view returns (uint);

    function registerModule(address module) external;
    function deregisterModule(address module) external;
    function isModuleRegistered(address module) external view returns (bool);
    function numOfModules() external view returns(uint);
}