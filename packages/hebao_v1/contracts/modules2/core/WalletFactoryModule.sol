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
pragma experimental ABIEncoderV2;

import "../../base/WalletFactory.sol";

import "../../iface/Controller.sol";
import "../../iface/Wallet.sol";

import "../../lib/AddressUtil.sol";

import "./MetaTxModule.sol";
import "./SignedRequest.sol";


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

    address public walletImplementation;

	bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "createWallet(Request request,address owner,string label,bytes labelApproval,address[] modules,bytes signature)"
    );

    constructor(
        Controller _controller,
        address    _trustedForwarder,
        address    _walletImplementation
        )
        public
        MetaTxModule(_controller, _trustedForwarder)
    {
        walletImplementation = _walletImplementation;
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param _owner The wallet's owner.
    /// @param _label The ENS subdomain to register, use "" to skip.
    /// @param _labelApproval The signature for ENS subdomain approval.
    /// @param _modules The wallet's modules.
    /// @return _wallet The newly created wallet's address.
    function createWallet(
        address            _owner,
        string    calldata _label,
        bytes     calldata _labelApproval,
        address[] calldata _modules,
        bytes     calldata _signature
        )
        external
        payable
        nonReentrant
        returns (address _wallet)
    {
    	bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            _owner,
            _label,
            keccak256(_labelApproval),
            keccak256(abi.encode(_modules)),
            keccak256(_signature)
		);

        bytes32 txHash = EIP712.hashPacked(DOMAIN_SEPERATOR, keccak256(encodedRequest));
        require(txHash.verifySignature(_owner, _signature), "INVALID_SIGNATURE");

        _wallet == createWalletInternal(controller, walletImplementation, _owner, address(this));

        Wallet w = Wallet(_wallet);
        for(uint i = 0; i < _modules.length; i++) {
            w.addModule(_modules[i]);
        }

        if (bytes(_label).length > 0) {
            controller.ensManager().register(
                _wallet,
                _label,
                _labelApproval
            );
        }
        w.removeModule(address(this));
    }
}
