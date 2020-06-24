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

import "../../iface/Module.sol";

import "./BaseModule.sol";
import "./MetaTxAware.sol";


/// @title MetaTxModule
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by GSN's contract codebase:
/// https://github.com/opengsn/gsn/contracts
contract MetaTxModule is MetaTxAware, BaseModule
{
    constructor(
        Controller _controller,
        address    _trustedRelayer
        )
        public
        BaseModule(controller)
        MetaTxAware(_trustedRelayer)
    {
    }

    modifier onlyFromWalletOwner(address wallet) virtual override {
        require(msgSender() == Wallet(wallet).owner(), "NOT_FROM_WALLET_OWNER");
        _;
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function activate()
        external
        override
        virtual
    {
        address wallet = msgSender();
        bindMethods(wallet);
        emit Activated(wallet);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function deactivate()
        external
        override
        virtual
    {
        address wallet = msgSender();
        unbindMethods(wallet);
        emit Deactivated(wallet);
    }
}

