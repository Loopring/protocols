// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


import "../../lib/ReentrancyGuard.sol";
import "../../lib/Claimable.sol";
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
contract Drainer is Claimable, Drainable
{
    function canDrain(address /*drainer*/, address /*token*/)
        public
        override
        view
        returns (bool) {
        return msg.sender == owner;
    }

    function initOwner(address _owner)
        external
    {
        // 0x4374D3d032B3c96785094ec9f384f07077792768 is my EOA address.
        require(msg.sender == 0x4374D3d032B3c96785094ec9f384f07077792768, "INVALID_SENDER");
        owner = _owner;
    }

    function withdrawExchangeStake(
        address loopringV3,
        uint exchangeId,
        uint amount,
        address recipient
        )
        onlyOwner
        external
    {
        ILoopringV3Partial(loopringV3).withdrawExchangeStake(exchangeId, recipient, amount);
    }

}
