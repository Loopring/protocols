// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../thirdparty/Cloneable.sol";

import "../../lib/Claimable.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title IExchange
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IExchange is Claimable, ReentrancyGuard
{
    event Cloned (address indexed clone);

    /// @dev Returns the exchange version
    /// @return The exchange version
    function version()
        public
        virtual
        view
        returns (string memory);

    /// @dev Clones an exchange without any initialization
    /// @return cloneAddress The address of the new exchange.
    function clone()
        external
        nonReentrant
        returns (address cloneAddress)
    {
        address origin = address(this);
        cloneAddress = Cloneable.clone(origin);

        assert(cloneAddress != origin);
        assert(cloneAddress != address(0));

        emit Cloned(cloneAddress);
    }
}
