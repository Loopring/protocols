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

import "../lib/Claimable.sol";
import "../lib/NamedAddressSet.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/SimpleProxy.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract WalletFactory is Claimable, NamedAddressSet, ReentrancyGuard
{
    string private constant MANAGER = "__MANAGER__";
    address public walletImplementation;

    event WalletCreated(
        address indexed wallet,
        address indexed owner
    );

    event ManagerAdded  (address indexed manager);
    event ManagerRemoved(address indexed manager);

    constructor(
        address _walletImplementation
        )
        public
        Claimable()
    {
        walletImplementation = _walletImplementation;
        addManager(owner);
    }

    modifier onlyManager
    {
        require(isManager(msg.sender), "NOT_A_MANAGER");
        _;
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _modules The wallet's modules.
    /// @return _wallet The newly created wallet's address.
    function createWallet(
        address   _owner,
        address[] calldata _modules
        )
        external
        payable
        onlyManager
        nonReentrant
        returns (address _wallet)
    {
        _wallet = createWalletInternal(_owner, _modules);
        emit WalletCreated(_wallet, _owner);
    }

    // TODO(daniel): use CREATE2?
    function createWalletInternal(
        address   _owner,
        address[] memory _modules
        )
        internal
        returns (address _wallet)
    {
        _wallet = address(new SimpleProxy(walletImplementation));
        Wallet(_wallet).setup(_owner, _modules);
    }

    /// @dev Checks if an address is a manger.
    /// @param addr The address to check.
    /// @return True if the address is a manager, False otherwise.
    function isManager(address addr)
        public
        view
        returns (bool)
    {
        return isAddressInSet(MANAGER, addr);
    }

    /// @dev Gets the managers.
    /// @return The list of managers.
    function managers()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(MANAGER);
    }

    /// @dev Adds a new manager.
    /// @param manager The new address to add.
    function addManager(address manager)
        public
        onlyOwner
    {
        addAddressToSet(MANAGER, manager);
        emit ManagerAdded(manager);
    }

    /// @dev Removes a manager.
    /// @param manager The manager to remove.
    function removeManager(address manager)
        public
        onlyOwner
    {
        removeAddressFromSet(MANAGER, manager);
        emit ManagerRemoved(manager);
    }
}