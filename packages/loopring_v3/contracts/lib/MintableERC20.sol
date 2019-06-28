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
pragma solidity 0.5.7;

import "./ERC20.sol";

/// @title MintableERC20 Interface
/// @author Daniel Wang - <daniel@loopring.org>
contract MintableERC20 is ERC20
{
    /// @dev the max token supply
    function maxSupply()
        public
        view
        returns (uint256);

    /// @dev set the max token supply.
    function setMaxSupply(
        uint256 _maxSupply
        )
        public;

    /// @dev mint new tokens for the given address.
    /// @param recipient The address to receive the new tokens
    /// @param amount The amount to mint
    function mint(
        address recipient,
        uint256 amount
        )
        public;

    /// @dev destroy certain tokens for the given address.
    /// @param recipient The address whose tokens will be destroyed
    /// @param amount The max amount to destroy
    /// @return The amount of tokens destroyed.
    function destroy(
        address recipient,
        uint256 amount
        )
        public
        returns (uint256 destroyed);
}
