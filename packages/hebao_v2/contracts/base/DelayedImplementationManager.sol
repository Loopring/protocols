// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../lib/Ownable.sol";

/**
 * @title DelayedImplementationManager
 * @author Kongliang Zhong - <kongliang@loopring.org>
 */
contract DelayedImplementationManager is Ownable {

    address public currImpl;
    address public nextImpl;
    uint    public nextEffectiveTime;

    event UpgradeScheduled(address nextImpl, uint effectiveTime);
    event UpgradeCancelled(address nextImpl);
    event ImplementationChanged(address newImpl);

    constructor(address initImpl) {
        require(initImpl != address(0), "ZERO_ADDRESS");
        currImpl = initImpl;
    }

    /**
     * @dev Allows the proxy owner to upgrade the current version of the proxy.
     * @param _nextImpl representing the address of the next implementation to be set.
     * @param _daysToDelay representing the amount of days after the next implementation take effect.
     */
    function delayedUpgradeTo(address _nextImpl, uint _daysToDelay) public onlyOwner {
        if (_nextImpl == address(0)) {
            require(nextImpl != address(0) && _daysToDelay == 0, "INVALID_ARGS");
            emit UpgradeCancelled(nextImpl);
            nextImpl = address(0);
        } else {
            require(_daysToDelay >= 1, "INVALID_DAYS");
            uint _nextEffectiveTime = block.timestamp + _daysToDelay * 1 days;
            nextImpl = _nextImpl;
            nextEffectiveTime = _nextEffectiveTime;
            emit UpgradeScheduled(_nextImpl, _nextEffectiveTime);
        }
    }

    /**
     * @dev Allows everyone to replace implementation after effective time.
     */
    function executeUpgrade() public {
        require(nextImpl != address(0) && block.timestamp >= nextEffectiveTime, "NOT_IN_EFFECT");
        currImpl = nextImpl;
        nextImpl = address(0);
        emit ImplementationChanged(currImpl);
    }

}
