// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../data/WhitelistData.sol";
import "../data/GuardianData.sol";
import "../data/InheritanceData.sol";
import "../data/SecurityData.sol";
import "./BaseTransferModule.sol";



/// @title TransferModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract TransferModule is BaseTransferModule
{
    using WhitelistData   for WalletDataLayout.State;
    using GuardianData    for WalletDataLayout.State;
    using InheritanceData for WalletDataLayout.State;
    using SecurityData    for WalletDataLayout.State;
    using SignatureUtil   for bytes32;
    using AddressUtil     for address;

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](7);
        methods[0] = this.transferToken.selector;
        methods[1] = this.transferTokens.selector;
        methods[2] = this.approveToken.selector;
        methods[3] = this.approveTokens.selector;
        methods[4] = this.callContract.selector;
        methods[5] = this.callContracts.selector;
        methods[6] = this.approveThenCallContract.selector;
    }

    function transferToken(
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata,
        bool           forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        __transferToken(token, to, amount, logdata, forceUseQuota);
    }

    function transferTokens(
        address[] calldata token,
        address[] calldata to,
        uint[]    calldata amount,
        bytes[]   calldata logdata,
        bool[]    calldata forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        uint size = token.length;
        require(
            size == to.length &&
            size == amount.length &&
            size == logdata.length &&
            size == forceUseQuota.length,
            "INVALID_SIZES"
        );

        for (uint i = 0; i < size; i++) {
           __transferToken(token[i], to[i], amount[i], logdata[i], forceUseQuota[i]);
        }
    }

    function approveToken(
        address token,
        address to,
        uint    amount,
        bool    forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
       __approveToken(token, to, amount, forceUseQuota);
    }

    function approveTokens(
        address[] calldata token,
        address[] calldata to,
        uint[]    calldata amount,
        bool[]    calldata forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        uint size = token.length;
        require(
            size == to.length &&
            size == amount.length &&
            size == forceUseQuota.length,
            "INVALID_SIZES"
        );

        for (uint i = 0; i < size; i++) {
            __approveToken(token[i], to[i], amount[i], forceUseQuota[i]);
        }
    }

    function callContract(
        address            to,
        uint               value,
        bytes     calldata data,
        bool               forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
        returns (bytes memory returnData)
    {
        return __callContract(to, value, data, forceUseQuota);
    }

    function callContracts(
        address[] calldata to,
        uint[]    calldata value,
        bytes[]   calldata data,
        bool[]    calldata forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
    {
        uint size = to.length;
        require(
            size == value.length &&
            size == data.length &&
            size == forceUseQuota.length,
            "INVALID_SIZES"
        );

        for (uint i = 0; i < size; i++) {
            __callContract(to[i], value[i], data[i], forceUseQuota[i]);
        }
    }

    function approveThenCallContract(
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data,
        bool           forceUseQuota
        )
        external
        txAwareHashNotAllowed
        onlyFromWalletOrOwnerWhenUnlocked
        returns (bytes memory returnData)
    {
        uint additionalAllowance = _approveToken(token, to, amount);

        if (forceUseQuota || !state.isAddressDappOrWhitelisted(to)) {
            _updateQuota(token, additionalAllowance);
            _updateQuota(address(0), value);
        }

        return _callContract(to, value, data);
    }

    function __transferToken(
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata,
        bool           forceUseQuota
        )
        private
    {
        if (forceUseQuota || !state.isAddressWhitelisted(to)) {
            _updateQuota(token, amount);
        }

        _transferToken(token, to, amount, logdata);
    }

    function __approveToken(
        address token,
        address to,
        uint    amount,
        bool    forceUseQuota
        )
        private
    {
        uint additionalAllowance = _approveToken(token, to, amount);

        if (forceUseQuota || !state.isAddressDappOrWhitelisted(to)) {
            _updateQuota(token, additionalAllowance);
        }
    }

    function __callContract(
        address         to,
        uint            value,
        bytes calldata  data,
        bool            forceUseQuota
        )
        private
        returns (bytes memory returnData)
    {
        if (forceUseQuota || !state.isAddressDappOrWhitelisted(to)) {
            _updateQuota(address(0), value);
        }

        return _callContract(to, value, data);
    }
}