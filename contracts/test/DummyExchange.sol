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
pragma solidity 0.5.2;

import "../iface/IExchange.sol";
import "../iface/ITradeDelegate.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract DummyExchange {

    address public tradeDelegateAddress = address(0x0);

    constructor(
        address _tradeDelegateAddress
        )
        public
    {
        tradeDelegateAddress = _tradeDelegateAddress;
    }

    function batchTransfer(
        bytes32[] memory data
        )
        public
    {
        ITradeDelegate(tradeDelegateAddress).batchTransfer(data);
    }

    function authorizeAddress(
        address addr
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).authorizeAddress(addr);
    }

    function deauthorizeAddress(
        address addr
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).deauthorizeAddress(addr);
    }

    function suspend()
        external
    {
        ITradeDelegate(tradeDelegateAddress).suspend();
    }

    function resume()
        external
    {
        ITradeDelegate(tradeDelegateAddress).resume();
    }

    function kill()
        external
    {
        ITradeDelegate(tradeDelegateAddress).kill();
    }
}
