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


/// @title DappTransfers
contract DappTransfers is TransferModule
{
    constructor(
        Controller _controller,
        address    _trustdRelayer
        )
        public
        TransferModule(_controller, _trustdRelayer) {}

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
        onlyFromWallet(wallet)
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
        onlyFromWallet(wallet)
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
        onlyFromWallet(wallet)
        returns (bytes memory returnData)
    {
        return callContractInternal(wallet, to, value, data);
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
        onlyFromWallet(wallet)
        returns (bytes memory returnData)
    {
        approveInternal(wallet, token, to, amount);
        return callContractInternal(wallet, to, value, data);
    }
}
