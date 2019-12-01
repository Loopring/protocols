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
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";

import "../stores/WhitelistStore.sol";

import "./SecurityModule.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
contract WhitelistModule is SecurityModule
{
    WhitelistStore  public whitelistStore;
    uint public delayPeriod;

    constructor(
        SecurityStore  _securityStore,
        WhitelistStore _whitelistStore,
        uint           _delayPeriod
        )
        public
        SecurityModule(_securityStore)
    {
        whitelistStore = _whitelistStore;
        delayPeriod = _delayPeriod;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        whitelistStore.addToWhitelist(wallet, addr, now + delayPeriod);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        whitelistStore.removeFromWhitelist(wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory timestamps
        )
    {
        return whitelistStore.whitelist(wallet);
    }

    function isWhitelisted(
        address wallet,
        address addr)
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint timestamp
        )
    {
        return whitelistStore.isWhitelisted(wallet, addr);
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.getWhitelist.selector;
        methods[1] = this.isWhitelisted.selector;
    }

    function extractMetaTxSigners(
        address       wallet,
        bytes4        method,
        bytes memory  /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.addToWhitelist.selector ||
            method == this.removeFromWhitelist.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
