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
import "../../iface/Wallet.sol";
import "../../lib/AddressUtil.sol";
import "../../thirdparty/ens/BaseENSManager.sol";
import "../base/MetaTxModule.sol";


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
    bool    public allowEmptyENS;

    struct WalletCreation {
        address owner;
        string label;
        bytes labelApproval;
        address[] modules;
    }

    bytes32 public constant CREATE_WALLET_TYPEHASH = keccak256(
        "WalletCreation(address owner,string label,bytes labelApproval,address[] modules)"
    );

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        address        _walletImplementation,
        bool           _allowEmptyENS
        )
        public
        MetaTxModule(_controller, _trustedForwarder)
    {
        walletImplementation = _walletImplementation;
        allowEmptyENS = _allowEmptyENS;
    }

    /// @dev Create a new wallet by deploying a proxy.
    /// @param wc wallet creation params
    /// @param signature The wallet owner's signature.
    /// @return _wallet The newly created wallet's address.
    function createWallet(
        WalletCreation calldata wc,
        bytes          calldata signature
        )
        external
        payable
        nonReentrant
        returns (address _wallet)
    {
        require(wc.modules.length > 0, "EMPTY_MODULES");

        bytes memory encodedRequest = abi.encode(
            CREATE_WALLET_TYPEHASH,
            wc.owner,
            keccak256(bytes(wc.label)),
            keccak256(wc.labelApproval),
            keccak256(abi.encode(wc.modules))
        );

        bytes32 txHash = EIP712.hashPacked(DOMAIN_SEPERATOR, encodedRequest);
        require(txHash.verifySignature(wc.owner, signature), "INVALID_SIGNATURE");

        _wallet = createWalletInternal(
            controller,
            walletImplementation,
            wc.owner,
            address(this)
        );

        Wallet w = Wallet(_wallet);
        for(uint i = 0; i < wc.modules.length; i++) {
            w.addModule(wc.modules[i]);
        }

        if (controller.ensManagerAddress() != address(0)) {
            if (bytes(wc.label).length > 0) {
                BaseENSManager(controller.ensManagerAddress()).register(
                    _wallet,
                    wc.label,
                    wc.labelApproval
                );
            } else {
                require(allowEmptyENS, "INVALID_ENS_LABEL");
            }
        }

        w.removeModule(address(this));
    }
}
