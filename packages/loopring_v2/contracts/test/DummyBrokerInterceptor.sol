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
pragma solidity 0.5.7;

import "../iface/IBrokerInterceptor.sol";
import "../iface/IRingSubmitter.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract DummyBrokerInterceptor is IBrokerInterceptor {

    mapping(address => mapping(address => mapping(address => uint))) public spent;
    mapping(address => mapping(address => mapping(address => uint))) public allowance;

    address public exchangeAddress = address(0x0);

    bool public doReentrancyAttack = false;
    bytes public submitRingsData;

    bool public doFailAllFunctions = false;

    constructor(
        address _exchangeAddress
        )
        public
    {
        require(_exchangeAddress != address(0x0), "Exchange address needs to be valid");
        exchangeAddress = _exchangeAddress;
    }

    function getAllowance(
        address owner,
        address broker,
        address token
        )
        public
        view
        returns (uint)
    {
        if (doFailAllFunctions) {
            assert(owner == address(0x0));
        }
        return allowance[broker][owner][token];
    }

    function onTokenSpent(
        address owner,
        address broker,
        address token,
        uint    amount
        )
        public
        returns (bool ok)
    {
        if (doFailAllFunctions) {
            require(owner == address(0x0), "Fake check");
        }
        if (doReentrancyAttack) {
            IRingSubmitter(exchangeAddress).submitRings(submitRingsData);
        }
        spent[broker][owner][token] += amount;
        ok = true;
    }

    function setAllowance(
        address broker,
        address owner,
        address token,
        uint amount
        )
        public
    {
        allowance[broker][owner][token] = amount;
    }

    function setReentrancyAttackEnabled(
        bool _enable,
        bytes memory _submitRingsData
        )
        public
    {
        doReentrancyAttack = _enable;
        submitRingsData = new bytes(_submitRingsData.length);
        for (uint i = 0; i < _submitRingsData.length; i++) {
            submitRingsData[i] = _submitRingsData[i];
        }
    }

    function setFailAllFunctions(
        bool _doFailAllFunctions
        )
        public
    {
        doFailAllFunctions = _doFailAllFunctions;
    }

}
