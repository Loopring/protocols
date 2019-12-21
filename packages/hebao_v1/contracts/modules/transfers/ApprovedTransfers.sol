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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";

import "./TransferModule.sol";


/// @title ApprovedTransfers
contract ApprovedTransfers is TransferModule
{
    constructor(Controller _controller)
        public
        TransferModule(_controller)
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        )
    {
        transferInternal(wallet, token, to, amount, logdata);
    }

    function transferTokensFullBalance(
        address            wallet,
        address[] calldata signers,
        address[] calldata tokens,
        address            to,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        )
    {
        for (uint i = 0; i < tokens.length; i++) {
            uint amount = (tokens[i] == address(0)) ?
                wallet.balance : ERC20(tokens[i]).balanceOf(wallet);
            transferInternal(wallet, tokens[i], to, amount, logdata);
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        )
    {
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        )
    {
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
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        )
    {
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
        override
        returns (address[] memory signers)
    {
        require (
            method == this.transferToken.selector ||
            method == this.transferTokensFullBalance.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector,
            "INVALID_METHOD"
        );
        return extractAddressesFromCallData(data, 1);
    }
}
