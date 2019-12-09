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
pragma experimental ABIEncoderV2;

import "../../base/MetaTxModule.sol";
import "../../base/WalletFactory.sol";

import "../../iface/Controller.sol";
import "../../iface/Wallet.sol";

import "../../lib/AddressUtil.sol";


/// @title WalletFactoryModule
/// @dev Factory to create new wallets and also register a ENS subdomain for
///      newly created wallets.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract WalletFactoryModule is WalletFactory, MetaTxModule
{
    using AddressUtil for address;

    event WalletCreated(
        address indexed wallet,
        address indexed owner,
        string  indexed subdomain
    );

    constructor(
        Controller _controller
        )
        public
        MetaTxModule(_controller)
    {

    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _expectedWallet The expected smart contract wallet address that will be created.
    /// @param _owner The wallet's owner.
    /// @param _modules The wallet's modules.
    /// @param _subdomain The ENS subdomain to register, use "" to skip.
    /// @return _wallet The newly created wallet's address.
    function createWallet(
        address            _expectedWallet,
        address            _owner,
        string    calldata _subdomain,
        address[] calldata _modules
        )
        external
        payable
        nonReentrant
    {
        address _wallet;
        if (bytes(_subdomain).length == 0) {
            _wallet = createWalletInternal(controller, _owner, _modules);
        } else {
            address[] memory extendedModules = new address[](_modules.length + 1);
            extendedModules[0] = address(this);
            for(uint i = 0; i < _modules.length; i++) {
                extendedModules[i + 1] = _modules[i];
            }
            _wallet = createWalletInternal(controller, _owner, extendedModules);
            controller.ensManager().register(_wallet, _subdomain);
            Wallet(_wallet).removeModule(address(this));
        }
        require(_wallet == _expectedWallet, "UNEXPECTED_WALLET_ADDRESS");
    }

    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        returns (address[] memory signers)
    {
        if (method == this.createWallet.selector) {
            signers = new address[](1);
            signers[0] = extractAddressFromCallData(data, 0);
        } else {
            revert("INVALID_METHOD");
        }
    }

    function areAuthorizedMetaTxSigners(
        address   wallet,
        bytes     memory /*data*/,
        address[] memory /*signers*/
        )
        private
        view
        returns (bool)
    {
        // The wallet doesn't exist yet, so the owner of the wallet (or any guardians) has not yet been set.
        // Only allow the future wallet owner to sign the meta tx if the wallet hasn't been created yet.
        return !wallet.isContract();
    }
}
