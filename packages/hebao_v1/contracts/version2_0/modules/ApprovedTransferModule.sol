// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../data/GuardianData.sol";
import "../data/InheritanceData.sol";
import "../data/SecurityData.sol";
import "./BaseTransferModule.sol";



/// @title ApprovedTransferModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract ApprovedTransferModule is BaseTransferModule
{
    using GuardianData    for WalletDataLayout.State;
    using InheritanceData for WalletDataLayout.State;
    using SecurityData    for WalletDataLayout.State;
    using SignatureUtil   for bytes32;
    using AddressUtil     for address;


    bytes32 public constant TRANSFER_TOKEN_TYPEHASH = keccak256(
        "transferToken(uint256 validUntil,address token,address to,uint256 amount,bytes logdata)"
    );
    bytes32 public constant APPROVE_TOKEN_TYPEHASH = keccak256(
        "approveToken(uint256 validUntil,address token,address to,uint256 amount)"
    );
    bytes32 public constant CALL_CONTRACT_TYPEHASH = keccak256(
        "callContract(uint256 validUntil,address to,uint256 value,bytes data)"
    );
    bytes32 public constant APPROVE_THEN_CALL_CONTRACT_TYPEHASH = keccak256(
        "approveThenCallContract(uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)"
    );

    function bindableMethods()
        public
        override
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](4);
        methods[0] = this.transferTokenWA.selector;
        methods[1] = this.callContractWA.selector;
        methods[2] = this.approveTokenWA.selector;
        methods[3] = this.approveThenCallContractWA.selector;
    }

    function transferTokenWA(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                TRANSFER_TOKEN_TYPEHASH,
                request.validUntil,
                token,
                to,
                amount,
                keccak256(logdata)
            )
        );

        _transferToken(token, to, amount, logdata);
    }

    function callContractWA(
        SignedRequest.Request calldata request,
        address        to,
        uint           value,
        bytes calldata data
        )
        external
        returns (bytes memory returnData)
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                CALL_CONTRACT_TYPEHASH,
                request.validUntil,
                to,
                value,
                keccak256(data)
            )
        );

        return _callContract(to, value, data);
    }

    function approveTokenWA(
        SignedRequest.Request calldata request,
        address token,
        address to,
        uint    amount
        )
        external
    {
        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                APPROVE_TOKEN_TYPEHASH,
                request.validUntil,
                token,
                to,
                amount
            )
        );

        _approveToken(token, to, amount);
    }

    function approveThenCallContractWA(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data
        )
        external
        returns (bytes memory returnData)
    {
        bytes memory encoded = abi.encode(
            APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
            request.validUntil,
            token,
            to,
            amount,
            value,
            keccak256(data)
        );

        _verifyRequest(
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            encoded
        );

        _approveToken(token, to, amount);
        return _callContract(to, value, data);
    }
}
