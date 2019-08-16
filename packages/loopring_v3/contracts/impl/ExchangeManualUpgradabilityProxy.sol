/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;

import "../thirdparty/OwnedUpgradabilityProxy.sol";

import "../lib/Claimable.sol";

import "../iface/IExchange.sol";
import "../iface/IExchangeUpgradabilityProxy.sol";
import "../iface/IProtocolRegistry.sol";


/// @title ExchangeManualUpgradabilityProxy
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeManualUpgradabilityProxy is IExchangeUpgradabilityProxy, Claimable, OwnedUpgradabilityProxy
{
    bytes32 private constant registryPosition = keccak256(
        "org.loopring.protocol.v3.registry"
    );
    bytes32 private constant protocolPosition = keccak256(
        "org.loopring.protocol.v3.protocol"
    );

    constructor(
        address _owner,
        address _registry
        )
        public
    {
        require(_owner != address(0), "INVALID_OWNER");
        setUpgradabilityOwner(_owner);

        IProtocolRegistry r = IProtocolRegistry(_registry);
        address _proto;
        address _impl;
        (_proto, _impl, ) = r.getExchangeProtocol(address(this));

        bytes32 position = registryPosition;
        assembly {
          sstore(position, _registry)
        }

        position = protocolPosition;
        assembly {
          sstore(position, _proto)
        }

        setImplementation(_impl);
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
        returns (address _addr)
    {
        bytes32 position = protocolPosition;
        assembly {
          _addr := sload(position)
        }
    }
}
