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

import "../iface/IBrokerRegistry.sol";
import "../iface/IBrokerInterceptor.sol";
import "../iface/IExchange.sol";
import "../iface/IMinerRegistry.sol";
import "../iface/IOrderRegistry.sol";
import "../iface/ITokenRegistry.sol";
import "../iface/ITradeDelegate.sol";

import "../lib/AddressUtil.sol";
import "../lib/BytesUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MemoryUtil.sol";
import "../lib/MultihashUtil.sol";
import "../lib/NoDefaultFunc.sol";

import "../spec/EncodeSpec.sol";
import "../spec/OrderSpecs.sol";
import "../spec/MiningSpec.sol";
import "../spec/RingSpecs.sol";

import "../helper/InputsHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";
import "../helper/MiningHelper.sol";

import "./Data.sol";
import "./ExchangeDeserializer.sol";


/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Brechtpd - <brecht@loopring.org>
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint      for uint;
    using BytesUtil     for bytes;
    using MiningSpec    for uint16;
    using EncodeSpec    for uint16[];
    using OrderSpecs    for uint16[];
    using RingSpecs     for uint8[][];
    using OrderHelper     for Data.Order;
    using RingHelper      for Data.Ring;
    using InputsHelper    for Data.Inputs;
    using MiningHelper    for Data.Mining;

    address public  lrcTokenAddress             = 0x0;
    address public  tokenRegistryAddress        = 0x0;
    address public  delegateAddress             = 0x0;
    address public  orderBrokerRegistryAddress  = 0x0;
    address public  minerBrokerRegistryAddress  = 0x0;
    address public  orderRegistryAddress        = 0x0;
    address public  minerRegistryAddress        = 0x0;

    uint64  public  ringIndex                   = 0;

    uint    public constant MAX_RING_SIZE       = 8;

    struct SubmitRingsParam {
        uint16[]    encodeSpecs;
        uint16      miningSpec;
        uint16[]    orderSpecs;
        uint8[][]   ringSpecs;
        address[]   addressList;
        uint[]      uintList;
        bytes[]     bytesList;
    }

    constructor(
        address _lrcTokenAddress,
        address _tokenRegistryAddress,
        address _delegateAddress
        )
        public
    {
        require(_lrcTokenAddress != 0x0);
        require(_tokenRegistryAddress != 0x0);
        require(_delegateAddress != 0x0);

        lrcTokenAddress            = _lrcTokenAddress;
        tokenRegistryAddress       = _tokenRegistryAddress;
        delegateAddress            = _delegateAddress;
    }

    function cancelOrders(
        address owner,
        bytes   orderHashes
        )
        external
    {
        uint size = orderHashes.length;
        require(size > 0 && size % 32 == 0);

        /* verifyAuthenticationGetInterceptor( */
        /*     owner, */
        /*     tx.origin */
        /* ); */

        size /= 32;
        bytes32[] memory hashes = new bytes32[](size);

        ITradeDelegate delegate = ITradeDelegate(delegateAddress);

        for (uint i = 0; i < size; i++) {
            hashes[i] = BytesUtil.bytesToBytes32(orderHashes, i * 32);
            delegate.setCancelled(owner, hashes[i]);
        }

        emit OrdersCancelled(
            owner,
            tx.origin,
            hashes
        );
    }

    function cancelAllOrdersForTradingPair(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        // verifyAuthenticationGetInterceptor(owner, tx.origin);

        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffs(
            owner,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPair(
            owner,
            tx.origin,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrders(
        address owner,
        uint   cutoff
        )
        external
    {
        /* verifyAuthenticationGetInterceptor( */
        /*     owner, */
        /*     tx.origin */
        /* ); */

        uint t = (cutoff == 0 || cutoff >= block.timestamp) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffs(owner, t);

        emit AllOrdersCancelled(
            owner,
            tx.origin,
            t
        );
    }

    event LogTrans(address token, address from, address to, uint amount); // for debug
    function submitRings(
        bytes data
        )
        public
    {
        Data.Context memory ctx = Data.Context(
            lrcTokenAddress,
            ITokenRegistry(tokenRegistryAddress),
            ITradeDelegate(delegateAddress),
            IBrokerRegistry(orderBrokerRegistryAddress),
            IBrokerRegistry(minerBrokerRegistryAddress),
            IOrderRegistry(orderRegistryAddress),
            IMinerRegistry(minerRegistryAddress)
        );

        (Data.Mining  memory mining,
            Data.Order[] memory orders,
            Data.Ring[]  memory rings) = ExchangeDeserializer.deserialize(ctx, data);

        for (uint i = 0; i < orders.length; i++) {
            // emit LogOrder(orders[i].owner, orders[i].tokenS, orders[i].amountS);

            orders[i].updateHash();
            orders[i].updateBrokerAndInterceptor(ctx);
            orders[i].checkBrokerSignature(ctx);
        }

        for (uint i = 0; i < rings.length; i++) {
            rings[i].updateHash();
        }

        mining.updateHash(rings);
        mining.updateMinerAndInterceptor(ctx);
        // mining.checkMinerSignature(ctx); // TODO: Brecht, fix this.

        for (uint i = 0; i < orders.length; i++) {
            // orders[i].checkDualAuthSignature(mining.hash); // TODO: Brecht, fix this.
        }

        for (uint i = 0; i < orders.length; i++) {
            orders[i].updateStates(ctx);
        }

        for (uint i = 0; i < rings.length; i++){
            rings[i].calculateFillAmountAndFee(mining);
            rings[i].settleRing(ctx, mining);
        }
    }

}
