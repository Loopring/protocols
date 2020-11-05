// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/BaseWallet.sol";
import "../../stores/SecurityStore.sol";
import "../base/BaseModule.sol";


/// @title AddOfficialGuardianModule
/// @dev This module adds the official guardian to a wallet and removes itself
///      from the module list.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract AddOfficialGuardianModule is BaseModule {
    ControllerImpl private immutable controller_;
    address        public  immutable officialGuardian;

    constructor(
        ControllerImpl   _controller,
        address          _officialGuardian
        )
        BaseModule(_controller)
    {
        controller_ = _controller;
        officialGuardian = _officialGuardian;
    }

    function activate()
        external
        override
    {
        address payable wallet = msg.sender;

        SecurityStore ss = securityStore;
        require(
            ss.numGuardians(wallet, true /* with pending */) == 0,
            "NOT_THE_FIRST_GUARDIAN"
        );

        ss.addGuardian(
            wallet,
            officialGuardian,
            block.timestamp,
            true
        );

        BaseWallet(wallet).removeModule(address(this));
    }
}
