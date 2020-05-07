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

import "../../lib/MathUint.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title InheritanceModule
contract InheritanceModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint public waitingPeriod;

    event Inherited(
        address indexed wallet,
        address indexed newOwner,
        uint            timestamp
    );

    constructor(
        Controller _controller,
        uint       _waitingPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_waitingPeriod > 0, "INVALID_DELAY");
        waitingPeriod = _waitingPeriod;
    }

    function boundMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.inheritor.selector;
    }

    function inheritor(address wallet)
        public
        view
        returns (address who, uint lastActive)
    {
        return controller.securityStore().inheritor(wallet);
    }

    function inherit(
        address wallet
        )
        external
        nonReentrant
    {
        (address newOwner, uint lastActive) = controller.securityStore().inheritor(wallet);
        require(newOwner != address(0), "NULL_INHERITOR");

        require(
            lastActive > 0 && now >= lastActive + waitingPeriod,
            "NEED_TO_WAIT"
        );

        require(
            msg.sender == address(this) || msg.sender == newOwner,
            "NOT_ALLOWED"
        );

        controller.securityStore().setInheritor(wallet, address(0));
        Wallet(wallet).setOwner(newOwner);

        emit Inherited(wallet, newOwner, now);
    }

    function setInheritor(
        address wallet,
        address who
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.securityStore().setInheritor(wallet, who);
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
        if (method == this.setInheritor.selector) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else if (method == this.inherit.selector) {
            (address newOwner, ) = controller.securityStore().inheritor(wallet);
            return isOnlySigner(newOwner, signers);
        } else {
            revert("INVALID_METHOD");
        }
    }
}
