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
pragma solidity ^0.6.6;

import "../lib/OwnerManagable.sol";
import "../lib/ReentrancyGuard.sol";
import "../thirdparty/OwnedUpgradabilityProxy.sol";
import "../thirdparty/Create2.sol";

import "../iface/Controller.sol";
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
contract WalletFactory is ReentrancyGuard
{
    event WalletCreated(
        address indexed wallet,
        address indexed owner
    );

    function computeWalletAddress(
        address owner
        )
        public
        view
        returns (address)
    {
        return Create2.computeAddress(
            getSalt(owner),
            getWalletCode()
        );
    }

    function createWalletInternal(
        Controller _controller,
        address    _implementation,
        address    _owner,
        address    _bootstrapModule
        )
        internal
        returns (address payable _wallet)
    {
        // Deploy the wallet
        _wallet = Create2.deploy(getSalt(_owner), getWalletCode());

        OwnedUpgradabilityProxy(_wallet).upgradeTo(_implementation);
        OwnedUpgradabilityProxy(_wallet).transferProxyOwnership(_wallet);

        Wallet(_wallet).setup(address(_controller), _owner, _bootstrapModule);

        _controller.walletRegistry().registerWallet(_wallet);

        emit WalletCreated(_wallet, _owner);
    }

    function getSalt(
        address owner
        )
        internal
        pure
        returns (bytes32 salt)
    {
        return keccak256(abi.encodePacked("WALLET_CREATION", owner));
    }

    function getWalletCode()
        internal
        pure
        returns (bytes memory)
    {
        return type(OwnedUpgradabilityProxy).creationCode;
    }
}