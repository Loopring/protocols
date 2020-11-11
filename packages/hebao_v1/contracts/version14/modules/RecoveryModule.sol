// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../data/WhitelistData.sol";
import "./SecurityModule.sol";



/// @title RecoveryModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract RecoveryModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    event Recovered       (address newOwner);

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](4);
        // methods[0] = this.addGuardian.selector;
        // methods[1] = this.addGuardianWA.selector;
        // methods[2] = this.removeGuardian.selector;
        // methods[3] = this.removeGuardianWA.selector;

        // methods[4] = this.removeFromWhitelist.selector;
        // methods[5] = this.removeFromWhitelistWA.selector;
    }

    // /// @dev Recover a wallet by setting a new owner.
    // /// @param request The general request object.
    // /// @param newOwner The new owner address to set.
    // function recover(
    //     SignedRequest.Request calldata request,
    //     address newOwner
    //     )
    //     external
    //     notWalletOwner(newOwner)
    //     eligibleWalletOwner(newOwner)
    // {
    //     SignedRequest.verifyRequest(
    //         hashStore,
    //         securityStore,
    //         GUARDIAN_DOMAIN_SEPERATOR,
    //         txAwareHash(),
    //         GuardianUtils.SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
    //         request,
    //         abi.encode(
    //             RECOVER_TYPEHASH,
    //             request.wallet,
    //             request.validUntil,
    //             newOwner
    //         )
    //     );

    //     SecurityStore ss = securityStore;
    //     if (ss.isGuardian(request.wallet, newOwner, true)) {
    //         ss.removeGuardian(request.wallet, newOwner, block.timestamp, true);
    //     }

    //     IWallet(request.wallet).setOwner(newOwner);
    //     _lockWallet(request.wallet, address(this), false);
    //     ss.cancelPendingGuardians(request.wallet);

    //     emit Recovered(request.wallet, newOwner);
    // }

    // function isLocked(address wallet)
    //     public
    //     view
    //     returns (bool)
    // {
    //     return _isWalletLocked(wallet);
    // }

    // // ---- internal functions ---

}
