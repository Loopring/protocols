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

import "../../../thirdparty/BytesUtil.sol";

import "../../security/SecurityModule.sol";


/// @title GenericDAppModule
/// @dev GenericDAppModule allows wallet owners to transact directly or through meta
///      transactions on the specified dApp. The transaction data must be appended
///      with the wallet address.
contract GenericDAppModule is SecurityModule
{
    using BytesUtil for bytes;

    address public dapp;
    string  public name;

    constructor(
        Controller    _controller,
        address       _dapp,
        string memory _name
        )
        public
        SecurityModule(_controller)
    {
        require(_dapp != address(0), "ZERO_ADDRESS");
        require(
            !controller.moduleRegistry().isModuleRegistered(_dapp),
            "MODULE_NOT_SUPPORTED"
        );
        require(
            !controller.walletRegistry().isWalletRegistered(_dapp),
            "WALLET_NOT_SUPPORTED"
        );
        dapp = _dapp;
        name = _name;
    }

    function()
        external
        payable
    {
        address wallet = extractWalletAddress(msg.data);
        require(!controller.securityStore().isLocked(wallet), "LOCKED");
        require(
            msg.sender == Wallet(wallet).owner() ||
            msg.sender == address(this),
            "NOT_FROM_METATX_OR_WALLET_OWNER"
        );
        controller.securityStore().touchLastActive(wallet);

        bytes memory txData = msg.data.slice(0, msg.data.length - 32);
        transactCall(wallet, dapp, msg.value, txData);
    }

    function extractWalletAddress(bytes memory data)
        internal
        pure
        returns (address wallet)
    {
        require(data.length >= 32, "INVALID_DATA");
        wallet = data.toAddress(msg.data.length - 32);
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  /* method */,
        bytes   memory /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
