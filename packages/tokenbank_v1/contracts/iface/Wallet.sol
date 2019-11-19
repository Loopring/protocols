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


/// @title Wallet
/// @dev Base contract for smart wallets.
///      Sub-contracts must NOT use non-default constructor to initialize
///      wallet states, instead, `init` shall be used. This is to enable
///      proxies to be deployed in front of the real wallet contract for
///      saving gas.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract Wallet
{
    function owner() public view returns (address);

    /// @dev Set up this wallet by assigning an original order and a
    ///      list of initial modules. For each module, its `init` method
    ///      will be called with `address(this)` as the parameter.
    ///
    ///      Note that calling this method more than once will throw.
    ///
    /// @param _owner The owner of this wallet, must not be address(0).
    /// @param _modules The list of modules to add to this wallet, this list
    ///                 must contain at least one module.
    function setup(address _owner, address[] calldata _modules) external;

    /// @dev Adds a new module. The `init` method of the module
    ///      will be called with `address(this)` as the parameter.
    ///      This method must throw if the module has already been added.
    /// @param _module The module's address.
    function addModule(address _module) external;

    /// @dev Removes an existing module. This method must throw if the module
    ///      has NOT been added or the module is the wallet's only module.
    /// @param _module The module's address.
    function removeModule(address _module) external;

    /// @dev Returns the list of modules added to this wallet in the order
    ///      they were added.
    /// @return _modules The list of modules added to this wallet.
    function modules() public view returns (address[] memory _modules);

    /// @dev Checks if a module has been added to this wallet.
    /// @param _module The module to check.
    /// @return True if the module exists; False otherwise.
    function hasModule(address _module) public view returns (bool);

    /// @dev Binds a static (readonly) method from the given module to this
    ///      wallet so the method can be invoked using this wallet's default
    ///      function.
    ///      Note that this method must throw when the given module has
    ///      not been added to this wallet.
    /// @param _method The method's 4-byte selector.
    /// @param _module The module's address. Use address(0) to unbind the method.
    function bindStaticMethod(bytes4 _method, address _module) external;

    /// @dev Returns the module the given method has been bound to.
    /// @param _method The method's 4-byte selector.
    /// @return _module The address of the bound module. If no binding exists,
    ///                 returns address(0) instead.
    function staticMethodModule(bytes4 _method) public view returns (address _module);

    /// @dev Returns this wallet's token or Ether balance.
    ///      This method provides a unified interface for both ERC20 and Ether.
    /// @param _token The token to check, address(0) represents Ether.
    /// @return _balance The token or Ether's balance.
    function tokenBalance(address _token)
        public
        view
        returns (uint _balance);

    /// @dev Transfers this wallet's token or Ether to another address.
    ///      This method provides a unified interface for both ERC20 and Ether.
    ///      This method will emit `Transacted` event if it doesn't throw.
    ///
    ///      Note: this method must ONLY allow invocations from a module that has
    ///      beeen added to this wallet. The wallet owner shall NOT be permitted
    ///      to call this method directly.
    ///
    ///      Also note that this method can be implemented using the `transact`
    ///      method as well. It is added for convenience.
    ///
    ///      Warning: caller must check this method's the return result!!!
    ///
    /// @param to The desitination address.
    /// @param value The amount to transfer.
    /// @param token The token to check, address(0) represents Ether/ETH.
    /// @return True if succeeded, False otherwise.
    function transferToken(
        address to,
        uint    value,
        address token
        )
        external
        returns (bool);

    /// @dev Performs generic transactions. Any module that has been added to this
    ///      wallet can use this method to transact on any third-party contract with
    ///      msg.sender as this wallet itself.
    ///
    ///      This method will emit `Transacted` event if it doesn't throw.
    ///
    ///      Note: this method must ONLY allow invocations from a module that has
    ///      beeen added to this wallet. The wallet owner shall NOT be permitted
    ///      to call this method directly.
    ///
    /// @param to The desitination address.
    /// @param value The amount of Ether to transfer.
    /// @param data The data to send over using `to.call.value(value)(data)`
    /// @return result The transaction's return value.
    function transact(
        address to,
        uint    value,
        bytes   calldata data
        )
        external
        returns (bytes memory result);
}