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

import "../iface/Module.sol";
import "../iface/Wallet.sol";

import "./WalletFactory.sol";


/// @title WalletFactoryWithENS
/// @dev Base contract for all smart wallet modules.
///      Each module must implement the `init` method. It will be called when
///      the module is added to the given wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract WalletFactoryWithENS is WalletFactory, Module
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
        WalletFactory(_walletImplementation)
    {
    }

    function createWallet(
        address   _owner,
        address[] calldata _modules,
        string    calldata _subdomain
        )
        external
        payable
        onlyManager
        nonReentrant
        returns (address walletAddress)
    {
        if (bytes(_subdomain).length > 0) {
            address[] memory extendedModules = new address[](_modules.length + 1);
            extendedModules[0] = address(this);
            for(uint i = 0; i < _modules.length; i++) {
                extendedModules[i + 1] = _modules[i];
            }
            walletAddress = createWalletInternal(_owner, extendedModules);

            Wallet wallet = Wallet(walletAddress);
            registerSubdomain(wallet, _subdomain);

            wallet.removeModule(address(this));
        } else {
            walletAddress = createWalletInternal(_owner, _modules);
        }
    }

    function registerSubdomain(
        Wallet _wallet,
        string  memory _subdomain
        )
        internal
    {
        // TODO
    }
}