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

import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/ITokenSeller.sol";


/// @title An Implementation of ITokenSeller.
/// @dev This contract simply transfers all assets to its owner.
/// @author Daniel Wang - <daniel@loopring.org>
contract NoOpTokenSeller is Claimable, ReentrancyGuard, ITokenSeller
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;

    constructor() Claimable() public {}

    function sellToken(
        address tokenS,
        uint amountS,
        address /* tokenB */
        )
        external
        nonReentrant
        returns (bool success)
    {
        require(amountS > 0, "ZERO_AMOUNT");
        if (tokenS == address(0)) {
            owner.sendETHAndVerify(amountS, gasleft());
        } else {
            tokenS.safeTransferAndVerify(owner, amountS);
        }
        return true;
    }
}