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
import "../iface/IOrderRegistry.sol";
import "../iface/ITokenRegistry.sol";
import "../iface/ITradeDelegate.sol";
import "../iface/IMinerRegistry.sol";

import "../lib/AddressUtil.sol";
import "../lib/BytesUtil.sol";
import "../lib/MemoryUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "../lib/MultihashUtil.sol";
import "../lib/NoDefaultFunc.sol";

import "../spec/OrderSpecs.sol";
import "../spec/MiningSpec.sol";
import "../spec/RingSpecs.sol";

import "../helper/InputsHelper.sol";
import "../helper/OrderHelper.sol";
import "../helper/RingHelper.sol";
import "../helper/MiningHelper.sol";

import "./Data.sol";


/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
///
/// Recognized contributing developers from the community:
///     https://github.com/Brechtpd
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract Exchange is IExchange, NoDefaultFunc {
    using MathUint      for uint;
    using MiningSpec    for uint16;
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

    event LogData(address a, uint i, uint i8, bytes32 bs);
    event LogBytes(bytes d);

    struct Test {
        address a;
        uint b;
        uint c;
        bytes32 d; // 32 * 4 = 128
    }

    function structCopyTest(bytes data) public {
        emit LogBytes(msg.data);
        Test memory t;
        uint ptr;
        assembly {
            ptr := t
        }

        MemoryUtil.copyCallDataBytesInArray(0, ptr, 0, 270);
        //copyStruct(0, ptr, 0, 270);
        emit LogData(t.a, t.b, t.c, t.d);
    }

    function copyStruct(
        uint parameterIndex,
        uint dst,
        uint offsetInBytes,
        uint numBytes
        )
        internal
        pure
    {
        assembly {
            let structOffset := add(32, add(4, mul(parameterIndex, 32)))
            calldatacopy(dst, structOffset, numBytes)
        }
    }

    function copyCallDataBytesInArray(
        uint parameterIndex,
        uint dst,
        uint offsetInBytes,
        uint numBytes
        )
        internal
        pure
    {
        assembly {
            let parameterOffset := add(calldataload(add(4, mul(parameterIndex, 32))), 4)
            calldatacopy(dst, add(add(parameterOffset, 32), offsetInBytes), numBytes)
        }
    }

    event LogParam(uint16 miningSpec, uint16[] orderSpecs, address[] addressList, uint[] uintList);

    event Log2DArr(uint8[] uis);
    event LogInt(uint16 i16);
    event LogIntArr(uint16[] arr);

    function submitRings(
        bytes data
        )
        public
    {
        // emit LogBytes(data);
        uint16 encodeSpecsLen = uint16(MemoryUtil.bytesToUintX(data, 0, 2));
        // emit LogInt(encodeSpecsLen);
        uint16[] memory encodeSpecs = new uint16[](encodeSpecsLen);
        for (uint i = 0; i < encodeSpecsLen; i ++) {
            uint offset = 2 + i * 2;
            uint16 spec = uint16(MemoryUtil.bytesToUintX(data, offset, 2));
            encodeSpecs[i] = spec;
        }
        emit LogIntArr(encodeSpecs);
        /* uint8[][] memory ringSpecs = new uint8[][](3); */
        /* uint8[] memory spec1 = new uint8[](2); */
        /* spec1[0] = 19; */
        /* spec1[1] = 10; */
        /* ringSpecs[0] = spec1; */
        /* emit Log2DArr(spec1); */
    }

    function submitRingsInternal(
        uint16 miningSpec,
        uint16[] orderSpecs,
        uint8[][] ringSpecs,
        address[] addressList,
        uint[] uintList,
        bytes[] bytesList
        )
        internal
    {
        emit LogParam(miningSpec, orderSpecs, addressList, uintList);
        /* Data.Context memory ctx = Data.Context( */
        /*     lrcTokenAddress, */
        /*     ITokenRegistry(tokenRegistryAddress), */
        /*     ITradeDelegate(delegateAddress), */
        /*     IBrokerRegistry(orderBrokerRegistryAddress), */
        /*     IBrokerRegistry(minerBrokerRegistryAddress), */
        /*     IOrderRegistry(orderRegistryAddress), */
        /*     IMinerRegistry(minerRegistryAddress) */
        /* ); */

        /* Data.Inputs memory inputs = Data.Inputs( */
        /*     addressList, */
        /*     uintList, */
        /*     bytesList, */
        /*     0, 0, 0  // current indices of addressLists, uintList, and bytesList. */
        /* ); */

        /* Data.Mining memory mining = Data.Mining( */
        /*     inputs.nextAddress(), */
        /*     (miningSpec.hasMiner() ? inputs.nextAddress() : address(0x0)), */
        /*     (miningSpec.hasSignature() ? inputs.nextBytes() : new bytes(0)), */
        /*     bytes32(0x0), // hash */
        /*     address(0x0),  // interceptor */
        /*     getSpendable( */
        /*         ctx.delegate, */
        /*         ctx.lrcTokenAddress, */
        /*         tx.origin, // TODO(daniel): pay from msg.sender? */
        /*         0x0, // broker */
        /*         0x0  // brokerInterceptor */
        /*     ) */
        /* ); */

        /* Data.Order[] memory orders = orderSpecs.assembleOrders(inputs); */
        /* Data.Ring[] memory rings = ringSpecs.assembleRings(orders, inputs); */

        /* handleSubmitRings(ctx, mining, orders, rings); */
    }

    function handleSubmitRings(
        Data.Context ctx,
        Data.Mining mining,
        Data.Order[] orders,
        Data.Ring[] rings
        )
        private
    {
        for (uint i = 0; i < orders.length; i++) {
            orders[i].updateHash();
            orders[i].updateBrokerAndInterceptor(ctx);
            orders[i].checkBrokerSignature(ctx);
        }

        for (uint i = 0; i < rings.length; i++) {
            rings[i].updateHash();
            mining.hash ^= rings[i].hash;
        }

        mining.updateHash();
        mining.updateMinerAndInterceptor(ctx);
        mining.checkMinerSignature(ctx);

        for (uint i = 0; i < orders.length; i++) {
            orders[i].checkDualAuthSignature(mining.hash);
        }

        for (uint i = 0; i < orders.length; i++) {
            orders[i].updateStates(ctx);
        }

        for (uint i = 0; i < rings.length; i++){
            rings[i].calculateFillAmountAndFee(mining);
        }
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    // TODO(daniel): there is another getSpendable in OrderHelper.
    function getSpendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address tokenOwner,
        address broker,
        address brokerInterceptor
        )
        private
        view
        returns (uint spendable)
    {
        ERC20 token = ERC20(tokenAddress);
        spendable = token.allowance(
            tokenOwner,
            address(delegate)
        );
        if (spendable == 0) {
            return;
        }
        uint amount = token.balanceOf(tokenOwner);
        if (amount < spendable) {
            spendable = amount;
            if (spendable == 0) {
                return;
            }
        }

        if (brokerInterceptor != tokenOwner) {
            amount = IBrokerInterceptor(brokerInterceptor).getAllowance(
                tokenOwner,
                broker,
                tokenAddress
            );
            if (amount < spendable) {
                spendable = amount;
            }
        }
    }

}
