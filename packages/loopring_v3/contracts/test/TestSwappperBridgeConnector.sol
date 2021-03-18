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

    struct GroupSettings
    {
        address tokenIn;
        address tokenOut;
    }

    struct UserSettings
    {
        uint minAmountOut;
    }

    struct TokenApprovals
    {
        address token;
        uint    amount;
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
        uint numTransfers = 0;
        for (uint g = 0; g < connectorCalls.groups.length; g++) {
            numTransfers += connectorCalls.groups[g].calls.length;
        }
        BridgeTransfer[] memory transfers = new BridgeTransfer[](numTransfers);
        uint transferIdx = 0;

        // Total ETH to re-deposit
        uint ethValueIn = 0;

        for (uint g = 0; g < connectorCalls.groups.length; g++) {
            GroupSettings memory settings = abi.decode(connectorCalls.groups[g].groupData, (GroupSettings));

            BridgeCall[] calldata calls = connectorCalls.groups[g].calls;

            bool[] memory valid = new bool[](calls.length);
            uint numValid = 0;

            uint amountInExpected = 0;
            for (uint i = 0; i < calls.length; i++) {
                valid[i] = calls[i].token == settings.tokenIn;
                if (valid[i]) {
                    amountInExpected = amountInExpected.add(calls[i].amount);
                }
            }

            // Get expected output amount
            uint amountOut = testSwapper.getAmountOut(
                settings.tokenIn,
                settings.tokenOut,
                amountInExpected
            );

            uint amountIn = 0;
            uint ammountInInvalid = 0;
            for (uint i = 0; i < calls.length; i++) {
                if(valid[i] && calls[i].userData.length == 32) {
                    UserSettings memory userSettings = abi.decode(calls[i].userData, (UserSettings));
                    uint userAmountOut = uint(calls[i].amount).mul(amountOut) / amountInExpected;
                    if (userAmountOut < userSettings.minAmountOut) {
                        valid[i] = false;
                    }
                }
                if (valid[i]) {
                    amountIn = amountIn.add(calls[i].amount);
                    numValid++;
                } else {
                    ammountInInvalid = ammountInInvalid.add(calls[i].amount);
                }
            }

            // Do the actual swap
            {
            uint ethValueOut = (settings.tokenIn == address(0)) ? amountIn : 0;
            if (settings.tokenIn != address(0)) {
                ERC20(settings.tokenIn).approve(address(testSwapper), amountIn);
            }
            amountOut = testSwapper.swap{value: ethValueOut}(
                settings.tokenIn,
                settings.tokenOut,
                amountIn
            );
            }

            // Create transfers back to the users
            for (uint i = 0; i < calls.length; i++) {
                if (valid[i]) {
                    // Give equal share to all valid calls
                    transfers[transferIdx++] = BridgeTransfer({
                        owner: calls[i].owner,
                        token: settings.tokenOut,
                        amount: (uint(calls[i].amount).mul(amountOut) / amountIn).toUint96()
                    });
                } else {
                    // Just transfer the tokens back
                    transfers[transferIdx++] = BridgeTransfer({
                        owner: calls[i].owner,
                        token: calls[i].token,
                        amount: calls[i].amount
                    });
                }
            }

            // Batch deposit
            // TODO: more batching
            // TODO: maybe use internal list to track allowances (maybe not needed with eip-2929)
            // TODO: pre-approve tokens where possible
            if (numValid != 0) {
                if (settings.tokenOut == address(0)) {
                    ethValueIn = ethValueIn.add(amountOut);
                } else {
                    uint allowance = ERC20(settings.tokenOut).allowance(address(this), address(depositContract));
                    ERC20(settings.tokenOut).approve(address(depositContract), allowance.add(amountOut));
                }
            }
            if (numValid != calls.length) {
                if (settings.tokenIn == address(0)) {
                    ethValueIn = ethValueIn.add(ammountInInvalid);
                } else {
                    uint allowance = ERC20(settings.tokenIn).allowance(address(this), address(depositContract));
                    ERC20(settings.tokenIn).approve(address(depositContract), allowance.add(ammountInInvalid));
                }
            }
        }

        IBridge(msg.sender).batchDeposit{value: ethValueIn}(transfers);
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