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

/// @author Brecht Devos - <brecht@loopring.org>
contract DummyExchange {

    address public tradeDelegateAddress = 0x0;
    address public feeHolderAddress = 0x0;

    constructor(
        address _tradeDelegateAddress,
        address _feeHolderAddress
        )
        public
    {
        tradeDelegateAddress = _tradeDelegateAddress;
        feeHolderAddress = _feeHolderAddress;
    }

    function batchAddFeeBalances(
        bytes32[] data
        )
        external
    {
        // Work around following solidity compile error:
        // 'UnimplementedFeatureError: Only byte arrays can be encoded from calldata currently.'
        bytes32[] memory batch = new bytes32[](data.length);
        for (uint i = 0; i < data.length; i++) {
            batch[i] = data[i];
        }
        IFeeHolder(feeHolderAddress).batchAddFeeBalances(batch);
    }

    function batchTransfer(
        bytes32[] data
        )
        external
    {
        // Work around following solidity compile error:
        // 'UnimplementedFeatureError: Only byte arrays can be encoded from calldata currently.'
        bytes32[] memory batch = new bytes32[](data.length);
        for (uint i = 0; i < data.length; i++) {
            batch[i] = data[i];
        }
        ITradeDelegate(tradeDelegateAddress).batchTransfer(batch);
    }

    function batchUpdateFilled(
        bytes32[] data
        )
        external
    {
        // Work around following solidity compile error:
        // 'UnimplementedFeatureError: Only byte arrays can be encoded from calldata currently.'
        bytes32[] memory batch = new bytes32[](data.length);
        for (uint i = 0; i < data.length; i++) {
            batch[i] = data[i];
        }
        ITradeDelegate(tradeDelegateAddress).batchUpdateFilled(batch);
    }

    function setCancelled(
        address owner,
        bytes32 orderHash
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setCancelled(owner, orderHash);
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
        address owner,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setCutoffs(owner, cutoff);
    }

    function setTradingPairCutoffs(
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external
    {
        ITradeDelegate(tradeDelegateAddress).setTradingPairCutoffs(owner, tokenPair, cutoff);
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
