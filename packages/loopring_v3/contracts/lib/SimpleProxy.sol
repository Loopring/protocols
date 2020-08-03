// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../thirdparty/Proxy.sol";


/// @title SimpleProxy
/// @author Daniel Wang  - <daniel@loopring.org>
contract SimpleProxy is Proxy
{
    bytes32 private constant implementationPosition = keccak256(
        "org.loopring.protocol.simple.proxy"
    );

    constructor(address _implementation)
    {
        bytes32 position = implementationPosition;
        assembly {sstore(position, _implementation) }
    }

    function implementation()
        public
        override
        view
        returns (address impl)
    {
        bytes32 position = implementationPosition;
        assembly { impl := sload(position) }
    }
}