// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

import "../thirdparty/Proxy.sol";

import "../iface/IExchange.sol";
import "../iface/IImplementationManager.sol";
import "../iface/IUniversalRegistry.sol";


/// @title ExchangeProxy
/// @dev This proxy is designed to support transparent upgradeability offered by a
///      IUniversalRegistry contract.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeProxy is Proxy
{
    bytes32 private constant registryPosition = keccak256(
        "org.loopring.protocol.v3.registry"
    );

    constructor(address _registry)
        public
    {
        bytes32 position = registryPosition;
        assembly {
          sstore(position, _registry)
        }
    }

    function registry()
        public
        view
        returns (address _addr)
    {
        bytes32 position = registryPosition;
        assembly {
          _addr := sload(position)
        }
    }

    function protocol()
        public
        view
        returns (address _protocol)
    {
        IUniversalRegistry r = IUniversalRegistry(registry());
        (_protocol, ) = r.getExchangeProtocol(address(this));
    }

    function implementation()
        public
        override
        view
        returns (address impl)
    {
        IUniversalRegistry r = IUniversalRegistry(registry());
        (, address implManager) = r.getExchangeProtocol(address(this));
        impl = IImplementationManager(implManager).defaultImpl();
    }
}
