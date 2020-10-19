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
    ControllerImpl private controller_;
    address        public  officialGuardian;
    uint           public  officialGuardianGroup;

    constructor(
        ControllerImpl   _controller,
        address          _officialGuardian,
        uint             _officialGuardianGroup
        )
    {
        controller_ = _controller;
        updateControllerCache();
        officialGuardian = _officialGuardian;
        officialGuardianGroup = _officialGuardianGroup;
    }

    function controller()
        internal
        view
        override
        returns(ControllerImpl)
    {
        return ControllerImpl(controller_);
    }

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
    }

    function activate()
        external
        override
    {
        address payable wallet = msg.sender;

        SecurityStore ss = controller().securityStore();
        require(
            ss.numGuardiansWithPending(wallet) == 0,
            "NOT_THE_FIRST_GUARDIAN"
        );

        ss.addGuardian(
            wallet,
            officialGuardian,
            officialGuardianGroup,
            block.timestamp
        );

        BaseWallet(wallet).removeModule(address(this));
    }
}
