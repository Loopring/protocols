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
    string internal constant ERC20_TRANSFER = "transfer(address,uint256)";

    event Activated (address indexed wallet);
    event Deactivated  (address indexed wallet);

    modifier onlyFromWallet(address wallet)
    {
        require(msg.sender == wallet, "NOT_FROM_WALLET");
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

    modifier onlyFromWalletOwner(address wallet) {
        require(Wallet(wallet).owner() == msg.sender, "NOT_FROM_WALLET_OWNER");
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
        onlyFromWalletOwner(wallet)
    {
        require(module != address(this), "SELF_ADD_PROHIBITED");
        Wallet(wallet).addModule(module);
    }

    /// @dev Removes a module from a wallet. Callable only by the wallet owner.
    ///      Note that the module must have been added to the wallet.
    function removeModule(
        address wallet,
        address module
        )
        external
        nonReentrant
        onlyFromWalletOwner(wallet)
    {
        require(module != address(this), "SELF_REMOVE_PROHIBITED");
        Wallet(wallet).removeModule(module);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function activate(address wallet)
        external
        nonReentrantExceptFrom(wallet)
        onlyFromWallet(wallet)
    {
        bindStaticMethods(wallet);
        emit Activated(wallet);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function deactivate(address wallet)
        external
        nonReentrantExceptFrom(wallet)
        onlyFromWallet(wallet)
    {
        unbindStaticMethods(wallet);
        emit Deactivated(wallet);
    }

    ///.@dev Gets the list of static methods for binding to wallets.
    ///      Sub-contracts should override this method to provide readonly methods for
    ///      wallet binding.
    /// @return methods A list of static method selectors for binding to the wallet
    ///         when this module is activated for the wallet.
    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
    }

    // ===== internal & private methods =====

    /// @dev Internal method to transact on the given wallet.
    function transact(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(to, value, data);
    }

    /// @dev Binds all static methods to the given wallet.
    function bindStaticMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = staticMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindStaticMethod(methods[i], address(this));
        }
    }

    /// @dev Unbinds all static methods from the given wallet.
    function unbindStaticMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = staticMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindStaticMethod(methods[i], address(0));
        }
    }

    /**
     * @dev Helper method to invoke a wallet.
     * @param _wallet The target wallet.
     * @param _to The target address for the transaction.
     * @param _value The value of the transaction.
     * @param _data The data of the transaction.
     */
    function invokeWallet(address _wallet, address _to, uint256 _value, bytes memory _data) internal returns (bytes memory _res) {
        bool success;
        // solium-disable-next-line security/no-call-value
        (success, _res) = _wallet.call(abi.encodeWithSignature("transact(address,uint256,bytes)", _to, _value, _data));
        if(success && _res.length > 0) { //_res is empty if _wallet is an "old" BaseWallet that can't return output values
            (_res) = abi.decode(_res, (bytes));
        } else if (_res.length > 0) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                returndatacopy(0, 0, returndatasize)
                revert(0, returndatasize)
            }
        } else if(!success) {
            revert("BM: wallet invoke reverted");
        }
    }

}
