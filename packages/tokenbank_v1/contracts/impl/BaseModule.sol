

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

import "../iface/Wallet.sol";
import "../iface/Module.sol";

contract BaseModule is Module
{
    modifier onlyWallet(address _wallet)
    {
        require(msg.sender == _wallet, "NOT_FROM_SAME_WALLET");
        _;
    }

    modifier onlyWalletOwner(address _wallet)
    {
        require(msg.sender == Wallet(_wallet).owner(), "NOT_FROM_WALLET_OWNER");
        _;
    }

    function initialize(address wallet)
      external
      onlyWallet(wallet)
    {
    }

    function addModule(address wallet, address module)
        external
        onlyWalletOwner(wallet)
    {
        Wallet(wallet).addModule(module);
    }

    function delModule(address wallet, address module)
        external
        onlyWalletOwner(wallet)
    {
        Wallet(wallet).delModule(module);
    }

    function addFunction(address wallet, bytes4 func, address module)
        external
        onlyWalletOwner(wallet)
    {
        Wallet(wallet).addFunction(func, module);
    }

    function delFunction(address wallet, bytes4 func)
        external
        onlyWalletOwner(wallet)
    {
        Wallet(wallet).delFunction(func);
    }

    function transact(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory result)
    {
        return Wallet(wallet).transact(to, value, data);
    }
}