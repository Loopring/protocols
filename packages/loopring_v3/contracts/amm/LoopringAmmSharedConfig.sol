// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";
import "./libamm/IAmmSharedConfig.sol";

contract LoopringAmmSharedConfig is Claimable, IAmmSharedConfig
{
    uint _maxForcedExitAge;
    uint _maxForcedExitCount;
    uint _forcedExitFee;

    event ValueChanged(string name, uint value);

    function maxForcedExitAge()
        external
        view
        override
        returns (uint)
    {
        return _maxForcedExitAge;
    }

    function maxForcedExitCount()
        external
        view
        override
        returns (uint)
    {
        return _maxForcedExitCount;
    }

    function forcedExitFee()
        external
        view
        override
        returns (uint)
    {
        return _forcedExitFee;
    }

    function setMaxForcedExitAge(uint v)
        external
        onlyOwner
    {
        _maxForcedExitAge = v;
        emit ValueChanged("maxForcedExitAge", v);
    }

    function setMaxForcedExitCount(uint v)
        external
        onlyOwner
    {
        _maxForcedExitCount = v;
        emit ValueChanged("maxForcedExitCount", v);
    }

    function setForcedExitFee(uint v)
        external
        onlyOwner
    {
        _forcedExitFee = v;
        emit ValueChanged("forcedExitFee", v);
    }
}
