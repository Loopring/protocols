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
        "transferToken(Request request,address token,address to,uint256 amount,bytes logdata)Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    );

    bytes32 public constant APPROVE_TOKEN_HASHTYPE = keccak256(
        "approveToken(Request request,address token,address to,uint256 amount)Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    );

    bytes32 public constant CALL_CONTRACT_HASHTYPE = keccak256(
        "callContract(Request request,address to,uint256 value,bytes data)Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    );

    bytes32 public constant APPROVE_THEN_CALL_CONTRACT_HASHTYPE = keccak256(
        "approveThenCallContract(Request request,address token,address to,uint256 amount,uint256 value,bytes data)Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    ); 

    constructor(
        Controller _controller,
        address    _trustedRelayer
        )
        public
        TransferModule(_controller, _trustedRelayer)
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
                SignedRequest.hash(request),
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
                SignedRequest.hash(request),
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
                SignedRequest.hash(request),
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
            SignedRequest.hash(request),
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
