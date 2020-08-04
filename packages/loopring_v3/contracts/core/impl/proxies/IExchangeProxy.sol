// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../../thirdparty/proxies/Proxy.sol";
import "../../iface/IImplementationManager.sol";
import "../../iface/IUniversalRegistry.sol";


/// @title IExchangeProxy
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IExchangeProxy is Proxy
{
    bytes32 private constant registryPosition = keccak256(
        "org.loopring.protocol.v3.registry"
    );

    constructor(address _registry)
    {
        setRegistry(_registry);
    }

    /// @dev Returns the exchange's registry address.
    function registry()
        public
        view
        returns (address registryAddress)
    {
        bytes32 position = registryPosition;
        assembly { registryAddress := sload(position) }
    }

    /// @dev Returns the exchange's protocol address.
    function protocol()
        public
        view
        returns (address protocolAddress)
    {
        IUniversalRegistry r = IUniversalRegistry(registry());
        (protocolAddress, ) = r.getExchangeProtocol(address(this));
    }

    function setRegistry(address _registry)
        private
    {
        require(_registry != address(0), "ZERO_ADDRESS");
        bytes32 position = registryPosition;
        assembly { sstore(position, _registry) }
    }
}