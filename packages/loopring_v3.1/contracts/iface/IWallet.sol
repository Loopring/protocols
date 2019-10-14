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


/// @title IWallet
/// @author Brecht Devos - <brecht@loopring.org>
contract IWallet
{
    /// @dev Transfers funds out of the contract to a specified address
    /// @param to The recipient of the funds
    /// @param token The token address (0x0 for ETH)
    /// @param amount The number of tokens transferred to the recipient
    /// @param data Custom data usable for e.g. additional authentication
    function transfer(
        address to,
        address token,
        uint    amount,
        bytes   calldata data
        )
        external;
}