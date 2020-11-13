// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../base/WalletDataLayout.sol";
import "../data/GuardianData.sol";
import "../data/SecurityData.sol";
import "./SecurityModule.sol";


/// @title QuotaModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract QuotaModule is SecurityModule
{
    using GuardianData  for WalletDataLayout.State;
    using SecurityData  for WalletDataLayout.State;
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint public constant QUOTA_PENDING_PERIOD = 1 days;

    bytes32 public constant CHANGE_DAILY_QUOTE_TYPEHASH = keccak256("changeDailyQuota(uint256 validUntil,uint256 newQuota)");

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](3);
        methods[0] = this.getDailyQuota.selector;
        methods[1] = this.changeDailyQuota.selector;
        methods[2] = this.changeDailyQuotaWA.selector;
    }

    function getDailyQuota()
        public
        view
        returns (
            uint total, // 0 indicates quota is disabled
            uint spent,
            uint available
        )
    {
        // total = quotaStore.currentQuota(wallet);
        // spent = quotaStore.spentQuota(wallet);
        // available = quotaStore.availableQuota(wallet);
    }

    function changeDailyQuota(uint newQuota)
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        _changeQuota(newQuota, QUOTA_PENDING_PERIOD);
    }

    function changeDailyQuotaWA(
        SignedRequest.Request calldata request,
        uint newQuota
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                CHANGE_DAILY_QUOTE_TYPEHASH,
                request.validUntil,
                newQuota
            )
        );
        _changeQuota(newQuota, 0);
    }

    function _changeQuota(
        uint    newQuota,
        uint    pendingPeriod
        )
        private
    {
        // uint _currentQuota = quotaStore.currentQuota(wallet);

        // uint _pendingPeriod = pendingPeriod;
        // if (_currentQuota == 0 || (newQuota > 0 && newQuota <= _currentQuota)) {
        //     _pendingPeriod = 0;
        // }

        // quotaStore.changeQuota(wallet, newQuota, block.timestamp.add(_pendingPeriod));
    }
}
