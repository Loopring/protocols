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
/// @dev This contract enables an alternative approach of getting back assets from Loopring Exchange v1.
/// Now you don't have to withdraw using merkle proofs (very expensive);
/// instead, all assets will be distributed on Loopring Exchange v2 - Loopring's new zkRollup implementation.
/// Please activate and unlock your address on https://exchange.loopring.io to claim your assets.
contract MigrationToLoopringExchangeV2 is Drainable
{
    function canDrain(address /*drainer*/, address /*token*/)
        public
        override
        view
        returns (bool) {
        return isMigrationOperator();
    }

    function withdrawExchangeStake(
        address loopringV3,
        uint exchangeId,
        uint amount,
        address recipient
        )
        external
    {
        require(isMigrationOperator(), "INVALID_SENDER");
        ILoopringV3Partial(loopringV3).withdrawExchangeStake(exchangeId, recipient, amount);
    }

    function isMigrationOperator() internal view returns (bool) {
        return msg.sender == 0x4374D3d032B3c96785094ec9f384f07077792768;
    }

}
