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

import "../security/SecurityModule.sol";

import "../../iface/Wallet.sol";
import "../../thirdparty/OwnedUpgradabilityProxy.sol";


/// @title WalletUpgraderModule
contract WalletUpgraderModule is SecurityModule
{
    constructor(
        Controller _controller
        )
        public
        SecurityModule(_controller)
    {

    }

    function upgradeWallet(
        address wallet,
        address implementation
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        require(
            controller.implementationRegistry().isImplementationRegistered(implementation),
            "INVALID_WALLET_IMPLEMENTATION"
        );

        bytes memory txData = abi.encodeWithSelector(
            OwnedUpgradabilityProxy(address(0x0)).upgradeTo.selector,
            implementation
        );
        transactCall(wallet, wallet, 0, txData);
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory
        )
        internal
        view
        returns (address[] memory signers)
    {
        if (method == this.upgradeWallet.selector) {
            signers = new address[](1);
            signers[0] = Wallet(wallet).owner();
        } else {
            revert("INVALID_METHOD");
        }
    }
}
