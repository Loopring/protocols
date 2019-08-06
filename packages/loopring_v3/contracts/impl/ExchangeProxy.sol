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
pragma solidity 0.5.10;

import "../iface/IProtocolRegistry.sol";

import "../thirdparty/Proxy.sol";


/// @title ExchangeProxy
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeProxy is Proxy
{
    bytes32 private constant registryPosition = keccak256("org.loopring.protocol.exchange.proxy.registry");
    bytes32 private constant loopringPosition = keccak256("org.loopring.protocol.exchange.proxy.loopring");

    constructor(
        address _registry,
        address _loopring
        )
        public
    {
        bytes32 position = registryPosition;
        assembly {
          sstore(position, _registry)
        }

        position = loopringPosition;
        assembly {
          sstore(position, _loopring)
        }
    }

    function registry() public view returns (address _addr)
    {
        bytes32 position = registryPosition;
        assembly {
          _addr := sload(position)
        }
    }

    function loopring() public view returns (address _addr)
    {
        bytes32 position = loopringPosition;
        assembly {
          _addr := sload(position)
        }
    }

    function implementation()
        public
        view
        returns (address _addr)
    {
        (_addr,) = IProtocolRegistry(registry()).getProtocol(loopring());
    }

    function version()
        public
        view
        returns (string memory _ver)
    {
        (, _ver) = IProtocolRegistry(registry()).getProtocol(loopring());
    }
}
