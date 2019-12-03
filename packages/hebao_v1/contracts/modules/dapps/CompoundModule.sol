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
pragma experimental ABIEncoderV2;

import "../security/SecurityModule.sol";

import "../../base/BaseSubAccount.sol";


/// @title CompoundModule
contract CompoundModule is BaseSubAccount, SecurityModule
{
    constructor(Controller _controller)
        public
        SecurityModule(_controller)
    {
    }

    /// @dev Fund Compound for earn interests and automatically enters market
    ///      so the funds will be used as collateral; or return borrowed assets
    ///      back to Compound.
    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {

        emit SubAccountTransfer(wallet, token, int(amount));
    }

    /// @dev Redeem fund from Compound.
    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        emit SubAccountTransfer(wallet, token, -int(amount));
    }

}
