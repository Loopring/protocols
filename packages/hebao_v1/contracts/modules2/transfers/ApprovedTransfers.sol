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

import "./TransferModule.sol";


/// @title ApprovedTransfers
contract ApprovedTransfers is TransferModule
{
    constructor(
        Controller _controller,
        address    _trustedRelayer
        )
        public
        TransferModule(_controller, _trustedRelayer) {}

    function transferToken(
        WalletMultisig.Request calldata request,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        bytes32 txhash; // TODO... nonce?
        controller.verifyPermission(request, txhash, GuardianUtils.SigRequirement.OwnerRequired);
        transferInternal(request.wallet, token, to, amount, logdata);
    }

    function approveToken(
        WalletMultisig.Request calldata request,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        bytes32 txhash; // TODO... nonce?
        controller.verifyPermission(request, txhash, GuardianUtils.SigRequirement.OwnerRequired);
        approveInternal(request.wallet, token, to, amount);
    }

    function callContract(
        WalletMultisig.Request calldata request,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        returns (bytes memory returnData)
    {
        bytes32 txhash; // TODO... nonce?
        controller.verifyPermission(request, txhash, GuardianUtils.SigRequirement.OwnerRequired);
        return callContractInternal(request.wallet, to, value, data);
    }

    function approveThenCallContract(
        WalletMultisig.Request calldata request,
        address            token,
        address            to,
        uint               amount,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        returns (bytes memory returnData)
    {
        bytes32 txhash; // TODO... nonce?
        controller.verifyPermission(request, txhash, GuardianUtils.SigRequirement.OwnerRequired);
        approveInternal(request.wallet, token, to, amount);
        return callContractInternal(request.wallet, to, value, data);
    }
}
