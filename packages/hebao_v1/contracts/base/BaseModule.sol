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

import "../lib/ReentrancyGuard.sol";

import "../iface/Wallet.sol";
import "../iface/Module.sol";


/// @title BaseModule
/// @dev This contract implements some common functions that are likely
///      be useful for all modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract BaseModule is ReentrancyGuard, Module
{
    event Activated   (address indexed wallet);
    event Deactivated (address indexed wallet);

    modifier onlyFromWallet(address wallet) virtual
    {
        require(msg.sender == wallet, "NOT_FROM_WALLET");
        _;
    }

    modifier onlyFromMetaTx() virtual {
        require(msg.sender == address(this), "NOT_FROM_META_TX");
        _;
    }

    modifier onlyFromWalletOwner(address wallet) virtual {
        require(msg.sender == Wallet(wallet).owner(), "NOT_FROM_WALLET_OWNER");
        _;
    }

    modifier onlyFromMetaTxOrWalletOwner(address wallet) virtual {
        require(
            msg.sender == address(this) || msg.sender == Wallet(wallet).owner(),
            "NOT_FROM_METATX_OR_WALLET_OWNER");
        _;
    }

    modifier onlyFromMetaTxOrOwner(address owner) virtual {
        require(
            msg.sender == address(this) || msg.sender == owner,
            "NOT_FROM_METATX_OR_OWNER");
        _;
    }

    modifier onlyWalletOwner(address wallet, address addr) virtual {
        require(Wallet(wallet).owner() == addr, "NOT_WALLET_OWNER");
        _;
    }

    modifier notWalletOwner(address wallet, address addr) virtual {
        require(Wallet(wallet).owner() != addr, "IS_WALLET_OWNER");
        _;
    }

    function addModule(
        address wallet,
        address module
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        Wallet(wallet).addModule(module);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function activate()
        external
        override
        virtual
    {
        bindMethods(msg.sender);
        emit Activated(msg.sender);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function deactivate()
        external
        override
        virtual
    {
        unbindMethods(msg.sender);
        emit Deactivated(msg.sender);
    }

    ///.@dev Gets the list of methods for binding to wallets.
    ///      Sub-contracts should override this method to provide methods for
    ///      wallet binding.
    /// @return methods A list of method selectors for binding to the wallet
    ///         when this module is activated for the wallet.
    function boundMethods()
        public
        pure
        virtual
        returns (bytes4[] memory methods)
    {
    }

    // ===== internal & private methods =====

    /// @dev Binds all methods to the given wallet.
    function bindMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = boundMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindMethod(methods[i], address(this));
        }
    }

    /// @dev Unbinds all methods from the given wallet.
    function unbindMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = boundMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindMethod(methods[i], address(0));
        }
    }

    function transactCall(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(1), to, value, data);
    }

    function transactDelegateCall(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(2), to, value, data);
    }

    function transactStaticCall(
        address wallet,
        address to,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(3), to, 0, data);
    }
}
