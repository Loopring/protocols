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

import "./SecurityModule.sol";


/// @title InheritanceModule
contract InheritanceModule is SecurityModule
{
    using AddressUtil   for address;
    using SignatureUtil for bytes32;

    uint public waitingPeriod;

    event Inherited(
        address indexed wallet,
        address indexed inheritor,
        uint            timestamp,
        bool            removedAsGuardian
    );

    event InheritorChanged(
        address indexed wallet,
        address indexed inheritor
    );

    constructor(
        ControllerImpl _controller,
        address      _trustedForwarder,
        uint        _waitingPeriod
        )
        public
        SecurityModule(_controller, _trustedForwarder)
    {
        require(_waitingPeriod > 0, "INVALID_DELAY");
        waitingPeriod = _waitingPeriod;
    }

    function inheritor(address wallet)
        public
        view
        returns (address who, uint lastActive)
    {
        return controller.securityStore().inheritor(wallet);
    }

    function inherit(
        address wallet,
        bool    removeAllGuardians
        )
        external
        nonReentrant
    {
        (address who, uint lastActive) = controller.securityStore().inheritor(wallet);
        require(msgSender() == who, "NOT_ALLOWED");

        require(lastActive > 0 && now >= lastActive + waitingPeriod, "NEED_TO_WAIT");

        SecurityStore securityStore = controller.securityStore();
        bool removedAsGuardian = securityStore.isGuardianOrPendingAddition(wallet, who);

        if (removeAllGuardians) {
            securityStore.removeAllGuardians(wallet);
        } else if (removedAsGuardian) {
            securityStore.removeGuardian(wallet, who, now);
        }

        securityStore.setInheritor(wallet, address(0));
        Wallet(wallet).setOwner(who);
        unlockWallet(wallet, true /*force*/);

        emit Inherited(wallet, who, now, removedAsGuardian);
    }

    function setInheritor(
        address wallet,
        address who
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromWallet(wallet)
    {
        (address existingInheritor,) = controller.securityStore().inheritor(wallet);
        require(existingInheritor != who, "SAME_INHERITOR");

        controller.securityStore().setInheritor(wallet, who);
        emit InheritorChanged(wallet, who);
    }
}
