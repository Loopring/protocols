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

import "../iface/IWallet.sol";
import "../test/AccountContract.sol";

import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";


/// @title Very basic hot wallet contract for use with fast withdrawals.
/// @author Brecht Devos - <brecht@loopring.org>
contract HotWallet is AccountContract, Claimable, IWallet {

    using AddressUtil       for address;
    using ERC20SafeTransfer for address;

    // List of addresses which can transfer funds out of this contract as tx.origin
    mapping (address => bool) authorizedAddresses;

    function transfer(
        address to,
        address token,
        uint    amount,
        bytes   calldata /*data*/
        )
        external
    {
        // Only allow an authorized transaction origin to transfer tokens out
        /* solium-disable-next-line */
        require(authorizedAddresses[tx.origin], "UNAUTHORIZED");

        // Transfer
        if (amount > 0) {
            if (token == address(0)) {
                // ETH
                to.sendETHAndVerify(amount, gasleft());
            } else {
                // ERC20 token
                token.safeTransferAndVerify(to, amount);
            }
        }
    }

    function setAuthorized(
        address _address,
        bool authorized
        )
        external
        onlyOwner
    {
        authorizedAddresses[_address] = authorized;
    }
}