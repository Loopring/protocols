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

    TestSwapper public immutable testSwapper;

    constructor(TestSwapper _testSwapper)
    {
        testSwapper = _testSwapper;
    }

    function processTransactions(ConnectorTxGroup[] memory groups)
        external
        payable
        override
        returns (IBatchDepositor.Deposit[] memory)
    {
        uint numDeposits = 0;
        for (uint g = 0; g < groups.length; g++) {
            numDeposits += groups[g].transactions.length;
        }
        IBatchDepositor.Deposit[] memory transfers = new IBatchDepositor.Deposit[](numDeposits);
        uint transferIdx = 0;

        ConnectorTx memory bridgeTx;
        for (uint g = 0; g < groups.length; g++) {
            GroupSettings memory settings = abi.decode(groups[g].groupData, (GroupSettings));

            ConnectorTx[] memory txs = groups[g].transactions;

            bool[] memory valid = new bool[](txs.length);
            uint numValid = 0;

            uint amountInExpected = 0;
            for (uint i = 0; i < txs.length; i++) {
                bridgeTx = txs[i];
                if (bridgeTx.token == settings.tokenIn) {
                    valid[i] = true;
                    amountInExpected = amountInExpected + bridgeTx.amount;
                }
            }

            // Get expected output amount
            uint amountOut = testSwapper.getAmountOut(
                settings.tokenIn,
                settings.tokenOut,
                amountInExpected
            );

            // Check for each call if the minimum slippage was achieved
            uint amountIn = 0;
            uint ammountInInvalid = 0;
            for (uint i = 0; i < txs.length; i++) {
                bridgeTx = txs[i];
                if(valid[i] && bridgeTx.userData.length == 32) {
                    UserSettings memory userSettings = abi.decode(bridgeTx.userData, (UserSettings));
                    uint userAmountOut = uint(bridgeTx.amount).mul(amountOut) / amountInExpected;
                    if (userAmountOut < userSettings.minAmountOut) {
                        valid[i] = false;
                    }
                }
                if (valid[i]) {
                    amountIn = amountIn.add(bridgeTx.amount);
                    numValid++;
                } else {
                    ammountInInvalid = ammountInInvalid.add(bridgeTx.amount);
                }
            }

            // Do the actual swap
            uint ethValueOut = (settings.tokenIn == address(0)) ? amountIn : 0;
            if (settings.tokenIn != address(0)) {
                ERC20(settings.tokenIn).approve(address(testSwapper), amountIn);
            }
            amountOut = testSwapper.swap{value: ethValueOut}(
                settings.tokenIn,
                settings.tokenOut,
                amountIn
            );

            // Create transfers back to the users
            for (uint i = 0; i < txs.length; i++) {
                if (valid[i]) {
                    // Give equal share to all valid calls
                    transfers[transferIdx++] = IBatchDepositor.Deposit({
                        owner:  txs[i].owner,
                        token:  settings.tokenOut,
                        amount: (uint(txs[i].amount).mul(amountOut) / amountIn).toUint96()
                    });
                } else {
                    // Just transfer the tokens back
                    transfers[transferIdx++] = IBatchDepositor.Deposit({
                        owner:  txs[i].owner,
                        token:  txs[i].token,
                        amount: txs[i].amount
                    });
                }
            }
        }
        assert(transfers.length == transferIdx);

        return transfers;
    }

    function getMinGasLimit(ConnectorTxGroup[] calldata groups)
        external
        pure
        override
        returns (uint gasLimit)
    {
        gasLimit = 40000;
        for (uint g = 0; g < groups.length; g++) {
           gasLimit += 100000 + 2500 * groups[g].transactions.length;
        }
    }

    receive()
        external
        payable
    {}
}
