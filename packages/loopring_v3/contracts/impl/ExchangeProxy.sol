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
