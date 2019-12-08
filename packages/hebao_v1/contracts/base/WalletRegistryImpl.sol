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
pragma solidity ^0.5.13;

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";

import "../iface/WalletRegistry.sol";


/// @title WalletRegistryImpl
/// @dev Basic implementation of a WalletRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletRegistryImpl is Claimable, AddressSet, WalletRegistry
{
    bytes32 internal constant WALLET = keccak256("__WALLET__");

    address internal factory;

    event WalletRegistered      (address indexed wallet);
    event WalletFactoryUpdated  (address indexed factory);

    modifier onlyFactory()
    {
        require(msg.sender == factory, "UNAUTHORIZED");
        _;
    }

    constructor() public Claimable() {}

    function setWalletFacgtory(address _factory)
        external
        onlyOwner
    {
        require(_factory != address(0), "ZERO_ADDRESS");
        factory = _factory;
        emit WalletFactoryUpdated(factory);
    }

    function registerWallet(address wallet)
        external
        onlyFactory
    {
        addAddressToSet(WALLET, wallet, false);
        emit WalletRegistered(wallet);
    }

    function isWallet(address addr)
        public
        view
        returns (bool)
    {
        return isAddressInSet(WALLET, addr);
    }

    function numOfWallets()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(WALLET);
    }
}