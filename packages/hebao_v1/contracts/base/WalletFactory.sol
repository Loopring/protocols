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

import "../lib/OwnerManagable.sol";
import "../lib/ReentrancyGuard.sol";
import "../lib/SimpleProxy.sol";

import "../iface/BankRegistry.sol";
import "../iface/Wallet.sol";
import "../iface/Module.sol";


/// @title WalletFactory
/// @dev A factory contract to create a new wallet by deploying a proxy
///      in front of a real wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract WalletFactory is OwnerManagable, ReentrancyGuard
{
    address public walletImplementation;

    event WalletCreated(
        address indexed wallet,
        address indexed owner
    );

    constructor(address _walletImplementation)
        public
        OwnerManagable()
    {
        walletImplementation = _walletImplementation;
        addManagerInternal(owner);
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _modules The wallet's modules.
    /// @return _wallet The newly created wallet's address.
    function createWallet(
        address _bankRegistry,
        address _owner,
        address[] calldata _modules
        )
        external
        payable
        nonReentrant
        onlyManager
        returns (address)
    {
        return createWalletInternal(_bankRegistry, _owner, _modules);
    }

    function createWalletInternal(
        address _bankRegistry,
        address _owner,
        address[] memory _modules
        )
        internal
        returns (address payable _wallet)
    {
        bytes32 salt = keccak256(abi.encodePacked("WALLET_CREATION", _owner));
        bytes memory code = type(SimpleProxy).creationCode;
        assembly {
            _wallet := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(extcodesize(_wallet)) {
                revert(0, 0)
            }
        }
        SimpleProxy(_wallet).setImplementation(walletImplementation);

        // Temporarily register this contract as a module to the wallet
        // so we can add/activate the modules.
        address[] memory setupModules = new address[](1);
        setupModules[0] = address(this);

        // Setup the wallet
        Wallet(_wallet).setup(_bankRegistry, _owner, setupModules);

        // Add/Activate modules
        for(uint i = 0; i < _modules.length; i++) {
            Wallet(_wallet).addModule(_modules[i]);
            Module(_modules[i]).activate(_wallet);
        }

        // Remove this contract from the wallet modules
        Wallet(_wallet).removeModule(address(this));

        emit WalletCreated(_wallet, _owner);
    }
}