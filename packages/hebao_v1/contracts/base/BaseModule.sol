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
contract BaseModule is Module, ReentrancyGuard
{
    bytes4 internal constant ERC20_TRANSFER = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 internal constant ERC20_APPROVE  = bytes4(keccak256("approve(address,uint256)"));

    event Activated   (address indexed wallet);
    event Deactivated (address indexed wallet);

    modifier onlyFromWallet(address wallet)
    {
        require(msg.sender == wallet, "NOT_FROM_WALLET");
        _;
    }

    modifier onlyFromMetaTx() {
        require(msg.sender == address(this), "NOT_FROM_META_TX");
        _;
    }

    modifier onlyFromWalletModule(address wallet)
    {
        require(Wallet(wallet).hasModule(msg.sender), "NOT_FROM_WALLET_MODULE");
        _;
    }

    modifier onlyFromWalletOwner(address wallet) {
        require(msg.sender == Wallet(wallet).owner(), "NOT_FROM_WALLET_OWNER");
        _;
    }

    modifier onlyFromMetaTxOrWalletOwner(address wallet) {
        require(
            msg.sender == address(this) || msg.sender == Wallet(wallet).owner(),
            "NOT_FROM_META)TX_OR_WALLET_OWNER");
        _;
    }

    modifier onlyWalletOwner(address wallet, address addr) {
        require(Wallet(wallet).owner() == addr, "NOT_WALLET_OWNER");
        _;
    }

    modifier notWalletOwner(address wallet, address addr) {
        require(Wallet(wallet).owner() != addr, "IS_WALLET_OWNER");
        _;
    }

    /// @dev Adds a module to a wallet. Callable only by the wallet owner.
    ///      Note that the module must have NOT been added to the wallet.
    ///
    ///      Also note that if `module == address(this)`, the wallet contract
    ///      will throw before calling `activate`, so there will be no re-entrant.
    function addModule(
        address wallet,
        address module
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(module != address(this), "SELF_ADD_PROHIBITED");
        Wallet(wallet).addModule(module);
        Module(module).activate(wallet);
    }

    /// @dev Removes a module from a wallet. Callable only by the wallet owner.
    ///      Note that the module must have been added to the wallet.
    function removeModule(
        address wallet,
        address module
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(module != address(this), "SELF_REMOVE_PROHIBITED");
        Module(module).deactivate(wallet);
        Wallet(wallet).removeModule(module);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function activate(address wallet)
        external
        onlyFromWalletModule(wallet)
    {
        bindMethods(wallet);
        emit Activated(wallet);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function deactivate(address wallet)
        external
        onlyFromWalletModule(wallet)
    {
        unbindMethods(wallet);
        emit Deactivated(wallet);
    }

    ///.@dev Gets the list of methods for binding to wallets.
    ///      Sub-contracts should override this method to provide methods for
    ///      wallet binding.
    /// @return methods A list of method selectors for binding to the wallet
    ///         when this module is activated for the wallet.
    function boundMethods()
        public
        pure
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
}
