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
import "../lib/SimpleProxy.sol";


// The concept/design of this class is inspired by Argent's contract codebase:
// https://github.com/argentlabs/argent-contracts


contract WalletFactory is Claimable, NamedAddressSet
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

    function isManager(address addr)
        public
        view
        returns (bool)
    {
        return isAddressInSet(MANAGER, addr);
    }

    function addManager(address manager)
        public
        onlyOwner
    {
        addAddressToSet(MANAGER, manager);
        emit ManagerAdded(manager);
    }

    function removeManager(address manager)
        public
        onlyOwner
    {
        removeAddressFromSet(MANAGER, manager);
        emit ManagerRemoved(manager);
    }

    function createWallet(
        address   _owner,
        address[] calldata _modules
        )
        external
        payable
        onlyManager
        returns (address walletAddress)
    {
        return createWalletInternal(_owner, _modules);
    }


    function createWalletInternal(
        address   _owner,
        address[] memory _modules
        )
        internal
        returns (address walletAddress)
    {
        SimpleProxy proxy = new SimpleProxy(walletImplementation);
        walletAddress = address(proxy);
        Wallet wallet = Wallet(walletAddress);

        wallet.init(_owner, _modules);
        emit WalletCreated(walletAddress, _owner);
    }
}