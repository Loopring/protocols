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

import "../../iface/Controller.sol";
import "../security/GuardianUtils.sol";


/// @title SecurityStore
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
contract SecurityModule is MetaTxModule
{
    SecurityStore internal securityStore;

    constructor(Controller _controller)
        public
        MetaTxModule(_controller)
    {
    }

    // overriding
    modifier onlyFromWalletOwner(address wallet) {
        require(
            msg.sender == Wallet(wallet).owner(),
            "NOT_FROM_WALLET_OWNER"
        );
        controller.securityStore().touchLastActive(wallet);
        _;
    }

    // overridding
    modifier onlyFromMetaTxOrWalletOwner(address wallet) {
        require(
            msg.sender == Wallet(wallet).owner() ||
            msg.sender == address(this),
            "NOT_FROM_METATX_OR_WALLET_OWNER"
        );
        controller.securityStore().touchLastActive(wallet);
        _;
    }

    modifier onlyWithMajority(
        address                      wallet,
        address[] memory             signers,
        GuardianUtils.SigRequirement requirement
        )
    {
        GuardianUtils.requireMajority(
            securityStore,
            wallet,
            signers,
            requirement
        );
        _;
    }

    modifier onlyWhenWalletLocked(address wallet)
    {
        require(controller.securityStore().isLocked(wallet), "NOT_LOCKED");
        _;
    }

    modifier onlyWhenWalletUnlocked(address wallet)
    {
        require(!controller.securityStore().isLocked(wallet), "LOCKED");
        _;
    }

    modifier onlyWalletGuardian(address wallet, address guardian)
    {
        require(controller.securityStore().isGuardian(wallet, guardian), "NOT_GUARDIAN");
        _;
    }

    modifier notWalletGuardian(address wallet, address guardian)
    {
        require(!controller.securityStore().isGuardian(wallet, guardian), "IS_GUARDIAN");
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

    function quotaManager() internal view returns (address)
    {
        return address(controller.quotaManager());
    }
}