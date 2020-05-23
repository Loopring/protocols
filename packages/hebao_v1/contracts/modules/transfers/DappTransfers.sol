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

import "../../lib/AddressSet.sol";
import "../../lib/ERC20.sol";

import "./TransferModule.sol";


/// @title DappTransfers
contract DappTransfers is TransferModule
{

    constructor(Controller _controller)
        public
        TransferModule(_controller)
    {
    }

    modifier onlyWhitelistedDapp(address addr)
    { 
        require(controller.dappAddressStore().isDapp(addr), "DISALLOWED");
        _; 
    }
    
    function transferToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata logdata
        )
        external
        nonReentrant
        onlyWhitelistedDapp(to)
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        transferInternal(wallet, token, to, amount, logdata);
    }

    function approveToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyWhitelistedDapp(to)
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        approveInternal(wallet, token, to, amount);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhitelistedDapp(to)
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        callContractInternal(wallet, to, value, data);
    }

    function approveThenCallContract(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhitelistedDapp(to)
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
    {
        approveInternal(wallet, token, to, amount);
        callContractInternal(wallet, to, value, data);
    }

    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory /*data*/,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        require (
            method == this.transferToken.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector,
            "INVALID_METHOD"
        );
        return GuardianUtils.requireMajority(
            controller.securityStore(),
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        );
    }
}
