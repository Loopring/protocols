// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


import "../../lib/ReentrancyGuard.sol";
import "../../lib/Drainable.sol";

abstract contract ILoopringV3Partial
{
    function withdrawExchangeStake(
        uint    exchangeId,
        address recipient,
        uint    requestedAmount
        )
        external
        virtual
        returns (uint amount);
}

/// @author Kongliang Zhong - <kongliang@loopring.org>
contract Drainer is Drainable
{
    function canDrain(address /*drainer*/, address /*token*/)
        public
        override
        view
        returns (bool) {
        return isOwner();
    }

    function withdrawExchangeStake(
        address loopringV3,
        uint exchangeId,
        uint amount,
        address recipient
        )
        external
    {
        require(isOwner(), "INVALID_SENDER");
        ILoopringV3Partial(loopringV3).withdrawExchangeStake(exchangeId, recipient, amount);
    }

    function isOwner() internal view returns (bool) {
        return msg.sender == 0x4374D3d032B3c96785094ec9f384f07077792768;
    }

}
