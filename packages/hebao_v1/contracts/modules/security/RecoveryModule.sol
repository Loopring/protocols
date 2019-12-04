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

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title RecoveryModule
contract RecoveryModule is SecurityModule
{
    event RecoveryStarted   (address indexed wallet, address indexed newOwner, uint completeAfter);
    event RecoveryCompleted (address indexed wallet, address indexed newOwner);
    event RecoveryCancelled (address indexed wallet);

    struct WalletRecovery {
        address newOwner;
        uint    completeAfter;
        uint    guardianCount;
    }

    mapping (address => WalletRecovery) public wallets;
    uint public recoveryPeriod;
    uint public lockPeriod;

    constructor(
        Controller _controller,
        uint      _recoveryPeriod,
        uint      _lockPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(recoveryPeriod <= lockPeriod, "INVALID_VALUES");
        recoveryPeriod = _recoveryPeriod;
        lockPeriod = _lockPeriod;
    }

    /// @dev Starts a recovery for a given wallet.
    /// @param wallet The wallet for which the recovery shall be cancelled.
    /// @param newOwner The new owner address to set.
    /// @param signers A list of addresses that signed the meta transaction.
    ///        The addresses must be sorted ascendently.
    function startRecovery(
        address            wallet,
        address[] calldata signers,
        address            newOwner
        )
        external
        nonReentrant
        onlyFromMetaTx
        notWalletOwner(wallet, newOwner)
    {
        require(newOwner != address(0), "ZERO_ADDRESS");

        uint guardianCount = controller.securityStore().numGuardians(wallet);
        require(guardianCount > 0, "NO_GUARDIAN");

        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter == 0, "ALREAY_STARTED");

        uint requiredCount = guardianCount / 2;
        if (guardianCount % 2 == 1) {
            requiredCount += 1;
        }

        require(signers.length >= requiredCount, "NOT_ENOUGH_SIGNER");

        recovery.newOwner = newOwner;
        recovery.completeAfter = now + recoveryPeriod;
        recovery.guardianCount = guardianCount;

        controller.securityStore().setLock(wallet, now + lockPeriod);

        emit RecoveryStarted(wallet, newOwner, recovery.completeAfter);
    }

    /// @dev Cancels a pending recovery for a given wallet.
    /// @param wallet The wallet for which the recovery shall be cancelled.
    /// @param signers A list of addresses that signed the meta transaction.
    ///        The addresses must be sorted ascendently.
    function cancelRecovery(
        address            wallet,
        address[] calldata signers // enforece data-layout, see extractMetaTxSigners.
        )
        external
        nonReentrant
        onlyFromMetaTx
    {
        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter > 0, "NOT_STARTED");

        uint guardianCount = wallets[wallet].guardianCount;
        require(signers.length >= (guardianCount + 1) / 2, "NOT_ENOUGH_SIGNER");

        delete wallets[wallet];
        controller.securityStore().setLock(wallet, 0);

        emit RecoveryCancelled(wallet);
    }

    /// @dev Complete a recovery by setting up the new owner.
    ///      This method can be called by anyone as long as the recoveryPeriod finishes.
    /// @param wallet The wallet for which the recovery shall complete.
    function completeRecovery(
        address            wallet,
        address[] calldata /*signers*/
        )
        external
        nonReentrant
    {
        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter > 0, "NOT_STARTED");
        require(recovery.completeAfter < now, "TWO_EARLY");

        Wallet(wallet).setOwner(recovery.newOwner);

        delete wallets[wallet];
        controller.securityStore().setLock(wallet, 0);

        emit RecoveryCompleted(wallet, recovery.newOwner);
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
        require (
            method == this.startRecovery.selector ||
            method == this.cancelRecovery.selector ||
            method == this.completeRecovery.selector,
            "INVALID_METHOD"
        );
        return extractAddressesFromCallData(data, 1);
    }
}
