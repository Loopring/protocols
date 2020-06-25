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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";

import "../core/SignedRequest.sol";

import "./TransferModule.sol";


/// @title ApprovedTransfers
contract ApprovedTransfers is TransferModule
{
    bytes32 public constant TRANSFER_TOKEN_HASHTYPE = keccak256(
        "transferToken(address wallet,uint256 nonce,address token,address to,uint256 amount,bytes logdata)"
    );

    bytes32 public constant APPROVE_TOKEN_HASHTYPE = keccak256(
        "approveToken(address wallet,uint256 nonce,address token,address to,uint256 amount)"
    );

    bytes32 public constant CALL_CONTRACT_HASHTYPE = keccak256(
        "callContract(address wallet,uint256 nonce,address to,uint256 value,bytes data)"
    );

    bytes32 public constant APPROVE_THEN_CALL_CONTRACT_HASHTYPE = keccak256(
        "approveThenCallContract(address wallet,uint256 nonce,address token,address to,uint256 amount,uint256 value,bytes data)"
    ); 

    constructor(
        Controller _controller,
        address    _trustedForwarder
        )
        public
        TransferModule(_controller, _trustedForwarder)
    {
    }

    function transferToken(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                TRANSFER_TOKEN_HASHTYPE,
                request.wallet,
                request.nonce,
                token,
                to,
                amount,
                keccak256(logdata)
            )
        );
        transferInternal(request.wallet, token, to, amount, logdata);
    }

    function approveToken(
        SignedRequest.Request calldata request,
        address token,
        address to,
        uint    amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                APPROVE_TOKEN_HASHTYPE,
                request.wallet,
                request.nonce,
                token,
                to,
                amount
            )
        );
        approveInternal(request.wallet, token, to, amount);
    }

    function callContract(
        SignedRequest.Request calldata request,
        address        to,
        uint           value,
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        returns (bytes memory returnData)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                CALL_CONTRACT_HASHTYPE,
                request.wallet,
                request.nonce,
                to,
                value,
                data
            )
        );

        return callContractInternal(request.wallet, to, value, data);
    }

    function approveThenCallContract(
        SignedRequest.Request calldata request,
        address        token,
        address        to,
        uint           amount,
        uint           value,
        bytes calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        returns (bytes memory returnData)
    {
        bytes memory encoded = abi.encode(
            APPROVE_THEN_CALL_CONTRACT_HASHTYPE,
            request.wallet,
            request.nonce,
            token,
            to,
            amount,
            value,
            data
        );

        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            encoded
        );

        approveInternal(request.wallet, token, to, amount);
        return callContractInternal(request.wallet, to, value, data);
    }
}
