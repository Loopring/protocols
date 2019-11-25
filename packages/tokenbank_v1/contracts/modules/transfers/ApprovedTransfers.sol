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

import "../../lib/ERC20.sol";

import "./TransferModule.sol";


/// @title ApprovedTransfers
contract ApprovedTransfers is TransferModule
{
    constructor(
        SecurityStore _securityStore
        )
        public
        TransferModule(_securityStore)
    {
    }

    function transferToken(
        address            wallet,
        address[] calldata signers,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
    {
        uint guardianCount = securityStore.numGuardians(wallet);
        require(signers.length >= (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(isWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        transferInternal(wallet, token, to, amount, logdata);
    }

    function transferTokens(
        address            wallet,
        address[] calldata signers,
        address[] calldata tokens,
        address            to,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
    {
        uint guardianCount = securityStore.numGuardians(wallet);
        require(signers.length >= (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(isWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint amount = (token == address(0)) ?
                wallet.balance : ERC20(token).balanceOf(wallet);

            transferInternal(wallet, token, to, amount, logdata);
        }
    }

    function approveToken(
        address            wallet,
        address[] calldata signers,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
        notWalletOrItsModule(wallet, to)
    {
        uint guardianCount = securityStore.numGuardians(wallet);
        require(signers.length >= (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(isWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        approveInternal(wallet, token, to, amount);
    }

    function callContract(
        address            wallet,
        address[] calldata signers,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
        notWalletOrItsModule(wallet, to)
    {
        uint guardianCount = securityStore.numGuardians(wallet);
        require(signers.length >= (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(isWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        callContractInternal(wallet, to, amount, data);
    }

    function approveThenCallContract(
        address            wallet,
        address[] calldata signers,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
        notWalletOrItsModule(wallet, to)
    {
        uint guardianCount = securityStore.numGuardians(wallet);
        require(signers.length >= (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(isWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        approveInternal(wallet, token, to, amount);
        callContractInternal(wallet, to, 0, data);
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
            method == this.transferToken.selector ||
            method == this.transferTokens.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector,
            "INVALID_METHOD"
        );

        // ASSUMPTION:
        // data layout: {data_length:32}{selector:4}{wallet:32}{signers_offset:32}{signers_length:32}{signer1:32}{signer2:32}
        require(data.length >= 100, "DATA_INVALID");

        uint numSigners;
        assembly { numSigners := mload(add(data, 100)) }
        require(data.length >= (100 + 32 * numSigners), "DATA_INVALID");

        signers = new address[](numSigners);

        address signer;
        for (uint i = 0; i < numSigners; i++) {
            uint start = 132 + 32 * i;
            assembly { signer := mload(add(data, start)) }
            signers[i] = signer;
        }
    }
}
