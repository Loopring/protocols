// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/AddressUtil.sol";

/// @author Kongliang Zhong - <kongliang@loopring.org>
contract ForcedWithdrawalAgent is ReentrancyGuard, OwnerManagable
{
    using AddressUtil for address;

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
    }

    function drain()
        external
        onlyOwner
    {
        owner.sendETHAndVerify(address(this).balance, gasleft());
    }

    receive() external payable { }
}
