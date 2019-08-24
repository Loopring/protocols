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

import "../iface/IFeeHolder.sol";
import "../iface/IRingSubmitter.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/ITradeHistory.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract DummyExchange {

    address public tradeDelegateAddress = address(0x0);
    address public tradeHistoryAddress = address(0x0);
    address public feeHolderAddress = address(0x0);
    address public ringSubmitterAddress = address(0x0);

    constructor(
        address _tradeDelegateAddress,
        address _tradeHistoryAddress,
        address _feeHolderAddress,
        address _ringSubmitterAddress
        )
        public
    {
        tradeDelegateAddress = _tradeDelegateAddress;
        tradeHistoryAddress = _tradeHistoryAddress;
        feeHolderAddress = _feeHolderAddress;
        ringSubmitterAddress = _ringSubmitterAddress;
    }

    function submitRings(
        bytes calldata data
        )
        external
    {
        IRingSubmitter(ringSubmitterAddress).submitRings(data);
    }

    function batchAddFeeBalances(
        bytes32[] memory data
        )
        public
    {
        IFeeHolder(feeHolderAddress).batchAddFeeBalances(data);
    }

    function batchTransfer(
        bytes32[] memory data
        )
        public
    {
        ITradeDelegate(tradeDelegateAddress).batchTransfer(data);
    }

    function batchUpdateFilled(
        bytes32[] memory data
        )
        public
    {
        ITradeHistory(tradeHistoryAddress).batchUpdateFilled(data);
    }

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        external
    {
        ITradeHistory(tradeHistoryAddress).setCancelled(broker, orderHash);
    }

    function setCutoffs(
        address broker,
        uint cutoff
        )
        external
    {
        ITradeHistory(tradeHistoryAddress).setCutoffs(broker, cutoff);
    }

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint cutoff
        )
        external
    {
        ITradeHistory(tradeHistoryAddress).setTradingPairCutoffs(broker, tokenPair, cutoff);
    }

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint cutoff
        )
        external
    {
        ITradeHistory(tradeHistoryAddress).setCutoffsOfOwner(broker, owner, cutoff);
    }

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external
    {
        ITradeHistory(tradeHistoryAddress).setTradingPairCutoffsOfOwner(broker, owner, tokenPair, cutoff);
    }

    function authorizeAddress(
        address addr
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).authorizeAddress(addr);
        ITradeHistory(tradeHistoryAddress).authorizeAddress(addr);
    }

    function deauthorizeAddress(
        address addr
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).deauthorizeAddress(addr);
        ITradeHistory(tradeHistoryAddress).deauthorizeAddress(addr);
    }

    function suspend()
        external
    {
        ITradeDelegate(tradeDelegateAddress).suspend();
        ITradeHistory(tradeHistoryAddress).suspend();
    }

    function resume()
        external
    {
        ITradeDelegate(tradeDelegateAddress).resume();
        ITradeHistory(tradeHistoryAddress).resume();
    }

    function kill()
        external
    {
        ITradeDelegate(tradeDelegateAddress).kill();
        ITradeHistory(tradeHistoryAddress).kill();
    }
}
