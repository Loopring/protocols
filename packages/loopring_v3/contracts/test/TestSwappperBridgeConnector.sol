// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./TestSwapper.sol";
import "../core/iface/IExchangeV3.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../thirdparty/SafeCast.sol";
import "../aux/bridge/IBridge.sol";
import "../aux/bridge/IBridgeConnector.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract TestSwappperBridgeConnector is IBridgeConnector
{
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SafeCast          for uint;

    struct Settings
    {
        address tokenIn;
        address tokenOut;
    }

    IExchangeV3        public immutable exchange;
    IDepositContract   public immutable depositContract;

    TestSwapper        public immutable testSwapper;

    constructor(
        IExchangeV3 _exchange,
        TestSwapper _testSwapper
        )
    {
        exchange = _exchange;
        depositContract = _exchange.getDepositContract();

        testSwapper = _testSwapper;
    }

    function processCalls(ConnectorCalls calldata connectorCalls)
        external
        payable
        override
    {
        for (uint g = 0; g < connectorCalls.groups.length; g++) {
            Settings memory settings = abi.decode(connectorCalls.groups[g].groupData, (Settings));

            BridgeCall[] calldata calls = connectorCalls.groups[g].calls;

            uint amountIn = 0;
            for (uint i = 0; i < calls.length; i++) {
                require(calls[i].token == settings.tokenIn, "INVALID_TOKEN");
                amountIn = amountIn.add(calls[i].amount);
            }

            uint ethValueOut = (settings.tokenIn == address(0)) ? amountIn : 0;
            uint amountOut = testSwapper.swap{value: ethValueOut}(amountIn);

            BridgeTransfer[] memory transfers = new BridgeTransfer[](calls.length);
            for (uint i = 0; i < transfers.length; i++) {
                transfers[i] = BridgeTransfer({
                    owner: transfers[i].owner,
                    token: settings.tokenOut,
                    amount: (uint(transfers[i].amount).mul(amountOut) / amountIn).toUint96()
                });
            }

            uint ethValueIn = 0;
            if (settings.tokenOut == address(0)) {
                ethValueIn = amountOut;
            } else {
                ERC20(settings.tokenOut).approve(address(depositContract), amountOut);
            }
            IBridge(msg.sender).batchDeposit{value: ethValueIn}(address(this), transfers);
        }
    }

    function getMinGasLimit(ConnectorCalls calldata connectorCalls)
        external
        pure
        override
        returns (uint gasLimit)
    {
        for (uint g = 0; g < connectorCalls.groups.length; g++) {
           gasLimit += 100000 + 2500 * connectorCalls.groups[g].calls.length;
        }
    }

    receive()
        external
        payable
    {}
}