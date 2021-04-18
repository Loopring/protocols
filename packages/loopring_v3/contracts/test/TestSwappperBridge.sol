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
contract TestSwappperBridge is IBridge
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

    function processCalls(BridgeCallGroup[] memory groups)
        external
        payable
        override
        returns (L2Transfer[] memory)
    {
        uint numTransfers = 0;
        for (uint g = 0; g < groups.length; g++) {
            numTransfers += groups[g].calls.length;
        }
        L2Transfer[] memory transfers = new L2Transfer[](numTransfers);
        uint transferIdx = 0;

        BridgeCall memory bridgeCall;
        for (uint g = 0; g < groups.length; g++) {
            GroupSettings memory settings = abi.decode(groups[g].groupData, (GroupSettings));

            BridgeCall[] memory calls = groups[g].calls;

            bool[] memory valid = new bool[](calls.length);
            uint numValid = 0;

            uint amountInExpected = 0;
            for (uint i = 0; i < calls.length; i++) {
                bridgeCall = calls[i];
                if (bridgeCall.token == settings.tokenIn) {
                    valid[i] = true;
                    amountInExpected = amountInExpected + bridgeCall.amount;
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
            for (uint i = 0; i < calls.length; i++) {
                bridgeCall = calls[i];
                if(valid[i] && bridgeCall.userData.length == 32) {
                    UserSettings memory userSettings = abi.decode(bridgeCall.userData, (UserSettings));
                    uint userAmountOut = uint(bridgeCall.amount).mul(amountOut) / amountInExpected;
                    if (userAmountOut < userSettings.minAmountOut) {
                        valid[i] = false;
                    }
                }
                if (valid[i]) {
                    amountIn = amountIn.add(bridgeCall.amount);
                    numValid++;
                } else {
                    ammountInInvalid = ammountInInvalid.add(bridgeCall.amount);
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
            for (uint i = 0; i < calls.length; i++) {
                if (valid[i]) {
                    // Give equal share to all valid calls
                    transfers[transferIdx++] = L2Transfer({
                        owner: calls[i].owner,
                        token: settings.tokenOut,
                        amount: (uint(calls[i].amount).mul(amountOut) / amountIn).toUint96()
                    });
                } else {
                    // Just transfer the tokens back
                    transfers[transferIdx++] = L2Transfer({
                        owner: calls[i].owner,
                        token: calls[i].token,
                        amount: calls[i].amount
                    });
                }
            }
        }
        assert(transfers.length == transferIdx);

        return transfers;
    }

    function getMinGasLimit(BridgeCallGroup[] calldata groups)
        external
        pure
        override
        returns (uint gasLimit)
    {
        gasLimit = 40000;
        for (uint g = 0; g < groups.length; g++) {
           gasLimit += 100000 + 2500 * groups[g].calls.length;
        }
    }

    receive()
        external
        payable
    {}
}