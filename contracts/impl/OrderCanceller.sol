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

import "../helper/MiningHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";

import "../iface/IBrokerRegistry.sol";
import "../iface/IFeeHolder.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/IOrderCanceller.sol";
import "../iface/ITradeDelegate.sol";

import "../lib/BytesUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MemoryUtil.sol";
import "../lib/MultihashUtil.sol";
import "../lib/NoDefaultFunc.sol";

import "./Data.sol";
import "./ExchangeDeserializer.sol";


/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Brechtpd - <brecht@loopring.org>
/// Recognized contributing developers from the community:
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract OrderCanceller is IOrderCanceller, NoDefaultFunc {

    address public delegateAddress = 0x0;

    constructor(
        address _delegateAddress
        )
        public
    {
        require(_delegateAddress != 0x0, ZERO_ADDRESS);

        delegateAddress = _delegateAddress;
    }

    function cancelOrders(
        bytes   orderHashes
        )
        external
    {
        uint size = orderHashes.length;
        require(size > 0 && size % 32 == 0, INVALID_SIZE);

        size /= 32;
        bytes32[] memory hashes = new bytes32[](size);

        ITradeDelegate delegate = ITradeDelegate(delegateAddress);

        for (uint i = 0; i < size; i++) {
            hashes[i] = BytesUtil.bytesToBytes32(orderHashes, i * 32);
            delegate.setCancelled(msg.sender, hashes[i]);
        }

        emit OrdersCancelled(
            msg.sender,
            hashes
        );
    }

    function cancelAllOrdersForTradingPair(
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffs(
            msg.sender,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPair(
            msg.sender,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrders(
        uint   cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffs(msg.sender, t);

        emit AllOrdersCancelled(
            msg.sender,
            t
        );
    }

    function cancelAllOrdersForTradingPairOfOwner(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffsOfOwner(
            msg.sender,
            owner,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPairByBroker(
            msg.sender,
            owner,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrdersOfOwner(
        address owner,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffsOfOwner(
            msg.sender,
            owner,
            t
        );

        emit AllOrdersCancelledByBroker(
            msg.sender,
            owner,
            t
        );
    }

}
