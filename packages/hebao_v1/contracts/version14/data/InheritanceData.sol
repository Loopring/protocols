// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";
import "../../iface/IPriceOracle.sol";


/// @title InheritanceData
/// @author Daniel Wang - <daniel@loopring.org>
library InheritanceData
{
    function inheritor(WalletDataLayout.State storage S)
        internal
        view
        returns (
            address _who,
            uint    _effectiveTimestamp
        )
    {
        // address _inheritor = wallets[wallet].inheritor;
        // if (_inheritor == address(0)) {
        //      return (address(0), 0);
        // }

        // uint32 _inheritWaitingPeriod = wallets[wallet].inheritWaitingPeriod;
        // if (_inheritWaitingPeriod == 0) {
        //     return (address(0), 0);
        // }

        // uint64 _lastActive = wallets[wallet].lastActive;

        // if (_lastActive == 0) {
        //     _lastActive = uint64(block.timestamp);
        // }

        // _who = _inheritor;
        // _effectiveTimestamp = _lastActive + _inheritWaitingPeriod;
    }


    function setInheritor(
        WalletDataLayout.State storage S,
        address who,
        uint32 _inheritWaitingPeriod
        )
        internal
    {
        // wallets[wallet].inheritor = who;
        // wallets[wallet].inheritWaitingPeriod = _inheritWaitingPeriod;
        // wallets[wallet].lastActive = uint64(block.timestamp);
    }
}
