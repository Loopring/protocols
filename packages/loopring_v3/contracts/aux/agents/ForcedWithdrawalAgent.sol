// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/Drainable.sol";

/// @author Kongliang Zhong - <kongliang@loopring.org>
contract ForcedWithdrawalAgent is ReentrancyGuard, OwnerManagable, Drainable
{
    using AddressUtil for address;

    function canDrain(address /*drainer*/, address /*token*/)
        public
        override
        view
        returns (bool) {
        return msg.sender == owner || isManager(msg.sender);
    }

    function doForcedWithdrawalFor(
        address exchangeAddress,
        address owner,
        address token,
        uint32 accountID
        )
        external
        payable
        nonReentrant
        onlyOwnerOrManager
    {
        IExchangeV3(exchangeAddress).forceWithdraw{value: msg.value}(owner, token, accountID);

        if (address(this).balance > 0) {
            drain(msg.sender, address(0));
        }
    }

    receive() external payable { }
}
