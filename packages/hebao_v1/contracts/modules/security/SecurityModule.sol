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

import "../../base/MetaTxModule.sol";

import "../stores/SecurityStore.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityModule is MetaTxModule
{
    SecurityStore internal securityStore;

    constructor(SecurityStore _securityStore)
        public
    {
        securityStore = _securityStore;
    }

    // overriding
    modifier onlyFromWalletOwner(address wallet) {
        require(
            msg.sender == Wallet(wallet).owner(),
            "NOT_FROM_WALLET_OWNER"
        );
        securityStore.touchLastActive(wallet);
        _;
    }

    // overridding
    modifier onlyFromMetaTxOrWalletOwner(address wallet) {
        require(
            msg.sender == Wallet(wallet).owner() ||
            msg.sender == address(this),
            "NOT_FROM_META)TX_OR_WALLET_OWNER"
        );
        securityStore.touchLastActive(wallet);
        _;
    }

    modifier onlyWhenWalletLocked(address wallet)
    {
        require(securityStore.isLocked(wallet), "NOT_LOCKED");
        _;
    }

    modifier onlyWhenWalletUnlocked(address wallet)
    {
        require(!securityStore.isLocked(wallet), "LOCKED");
        _;
    }

    modifier onlyWalletGuardian(address wallet, address guardian)
    {
        require(securityStore.isGuardian(wallet, guardian), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!securityStore.isGuardian(wallet, guardian), "IS_GUARDIAN");
        _;
    }

    modifier onlyFromMetaTxOr(address guardian)
    {
        require(
            msg.sender == address(this) || msg.sender == guardian,
            "UNAUTHORIZED"
        );
        _;
    }

    function isWalletOwnerOrGuardian(address wallet, address addr)
        internal
        view
        returns (bool)
    {
        return Wallet(wallet).owner() == addr ||
            securityStore.isGuardian(wallet, addr);
    }

    function isWalletOwnerOrGuardian(address wallet, address[] memory addrs)
        internal
        view
        returns (bool)
    {
        if (addrs.length == 0) return false;

        for (uint i = 0; i < addrs.length; i++) {
            if (!isWalletOwnerOrGuardian(wallet, addrs[i])) {
                return false;
            }
        }
        return true;
    }
}