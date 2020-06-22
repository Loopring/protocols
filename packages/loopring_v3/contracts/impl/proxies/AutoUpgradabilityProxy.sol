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
pragma solidity ^0.6.10;

import "../../iface/IExchangeProxy.sol";
import "../../iface/IImplementationManager.sol";
import "../../iface/IUniversalRegistry.sol";


/// @title AutoUpgradabilityProxy
/// @dev This proxy is designed to support automatic upgradability.
/// @author Daniel Wang  - <daniel@loopring.org>
contract AutoUpgradabilityProxy is IExchangeProxy
{
    constructor(address _registry) public IExchangeProxy(_registry) {}

    function implementation()
        public
        override
        view
        returns (address)
    {
        IUniversalRegistry r = IUniversalRegistry(registry());
        (, address managerAddr) = r.getExchangeProtocol(address(this));
        return IImplementationManager(managerAddr).defaultImpl();
    }
}