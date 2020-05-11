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
pragma solidity ^0.6.6;

import "../thirdparty/Proxy.sol";

import "../iface/IImplementationManager.sol";
import "../iface/IUniversalRegistry.sol";


/// @title IExchangeProxy
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IExchangeProxy is Proxy
{
    bytes32 private constant registryPosition = keccak256(
        "org.loopring.protocol.v3.registry"
    );

    constructor(address _registry)
        public
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