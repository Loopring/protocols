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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/ITradeDelegate.sol";
import "../iface/IFeeHolder.sol";
import "../iface/IRingSubmitter.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract DummyExchange {

    address public tradeDelegateAddress = 0x0;
    address public feeHolderAddress = 0x0;
    address public ringSubmitterAddress = 0x0;

    constructor(
        address _tradeDelegateAddress,
        address _feeHolderAddress,
        address _ringSubmitterAddress
        )
        public
    {
        tradeDelegateAddress = _tradeDelegateAddress;
        feeHolderAddress = _feeHolderAddress;
        ringSubmitterAddress = _ringSubmitterAddress;
    }

    function submitRings(
        bytes data
        )
        external
    {
        IRingSubmitter(ringSubmitterAddress).submitRings(data);
    }

    function batchAddFeeBalances(
        bytes32[] data
        )
        public
    {
        IFeeHolder(feeHolderAddress).batchAddFeeBalances(data);
    }

    function batchTransfer(
        bytes32[] data
        )
        public
    {
        ITradeDelegate(tradeDelegateAddress).batchTransfer(data);
    }

    function batchUpdateFilled(
        bytes32[] data
        )
        public
    {
        ITradeDelegate(tradeDelegateAddress).batchUpdateFilled(data);
    }

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setCancelled(broker, orderHash);
    }

    function addFilled(
        bytes32 orderHash,
        uint amount
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).addFilled(orderHash, amount);
    }

    function setFilled(
        bytes32 orderHash,
        uint amount
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setFilled(orderHash, amount);
    }

    function setCutoffs(
        address broker,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setCutoffs(broker, cutoff);
    }

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setTradingPairCutoffs(broker, tokenPair, cutoff);
    }

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setCutoffsOfOwner(broker, owner, cutoff);
    }

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setTradingPairCutoffsOfOwner(broker, owner, tokenPair, cutoff);
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
