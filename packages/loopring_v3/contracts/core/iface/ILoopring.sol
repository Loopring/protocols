// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/Claimable.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title ILoopring
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract ILoopring is Claimable, ReentrancyGuard
{
    address public universalRegistry;
    address public lrcAddress;

    /// @dev Returns the exchange version
    /// @return The exchange version
    function version()
        public
        virtual
        view
        returns (string memory);

    /// @dev Registers an exchange.
    /// @param  exchangeAddr The address of the exchange.
    /// @param  exchangeImpl The address of the exchange implementation.
    function registerExchange(
        address exchangeAddr,
        address exchangeImpl
        )
        external
        virtual;
}
