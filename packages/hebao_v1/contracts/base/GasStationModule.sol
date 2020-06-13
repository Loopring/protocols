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

import '@opengsn/gsn/contracts/BaseRelayRecipient.sol';
import '@opengsn/gsn/contracts/interfaces/IKnowForwarderAddress.sol';

import "../base/BaseModule.sol";
import "../iface/Controller.sol";
import "../lib/ReentrancyGuard.sol";

/// @title GasStationModule
/// @dev This is the base module for supporting GasStationModule.
contract GasStationModule is ReentrancyGuard, BaseRelayRecipient, IKnowForwarderAddress, BaseModule
{
    Controller public controller;

    constructor(Controller _controller)
        public
        BaseModule()
    {
        controller = _controller;
        trustedForwarder = _controller.trustedForwarder();
    }

    function versionRecipient()
        external
        virtual
        view
        override
        returns (string memory)
    {
        return "1.0";
    }

    function getTrustedForwarder()
        public
        view
        override
        returns(address)
    {
        return trustedForwarder;
    }

    modifier onlyFromWalletOwner(address wallet)
        virtual
        override
    {
        require(_msgSender() == Wallet(wallet).owner(), "NOT_FROM_WALLET_OWNER");
        _;
    }

}
