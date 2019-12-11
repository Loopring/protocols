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

import "../../../lib/AddressSet.sol";
import "../../../lib/Claimable.sol";
import "../../../thirdparty/BytesUtil.sol";

import "../../security/SecurityModule.sol";


/// @title GenericDAppModule
/// @dev GenericDAppModule allows wallet owners to transact directly or through meta
///      transactions on any whitelisted dApps. The transaction data must be appended
///      with the wallet address and then the dApp's address.
contract GenericDAppModule is Claimable, AddressSet, SecurityModule
{
    using BytesUtil for bytes;

    bytes32 internal constant DAPPS = keccak256("__DAPP__");

    event DAppEnabled(address indexed dapp, bool enabled);

    constructor(Controller _controller)
        public
        Claimable()
        SecurityModule(_controller)
    {
    }

    function enableDApp(address dapp)
        external
        onlyOwner
    {
        require(
            !controller.moduleRegistry().isModuleRegistered(dapp),
            "MODULE_NOT_SUPPORTED"
        );
        require(
            !controller.walletRegistry().isWalletRegistered(dapp),
            "WALLET_NOT_SUPPORTED"
        );
        addAddressToSet(DAPPS, dapp, true);
        emit DAppEnabled(dapp, true);
    }

    function disableDApp(address dapp)
        external
        onlyOwner
    {
        removeAddressFromSet(DAPPS, dapp);
        emit DAppEnabled(dapp, false);
    }

    function isDAppEnabled(address dapp)
        public
        view
        returns (bool)
    {
        return isAddressInSet(DAPPS, dapp);
    }

    function enabledDApps()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(DAPPS);
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

        address dapp = msg.data.toAddress(msg.data.length - 32);
        require(isAddressInSet(DAPPS, dapp), "DAPP_UNAUTHORIZED");

        bytes memory txData = msg.data.slice(0, msg.data.length - 64);
        transactCall(wallet, dapp, msg.value, txData);
    }

    function extractWalletAddress(bytes memory data)
        internal
        pure
        returns (address wallet)
    {
        require(data.length >= 64, "INVALID_DATA");
        wallet = data.toAddress(msg.data.length - 64);
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
