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


/// Migrates from Loopring to ... Loopring!
/// @author Brecht Devos - <brecht@loopring.org>
contract TestMigrationBridgeConnector is IBridgeConnector
{
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SafeCast          for uint;

    struct GroupSettings
    {
        address token;
    }

    struct UserSettings
    {
        address to;
    }

    IExchangeV3        public immutable exchange;
    IDepositContract   public immutable depositContract;

    IBridge            public immutable bridge;

    constructor(
        IExchangeV3 _exchange,
        IBridge     _bridge
        )
    {
        exchange = _exchange;
        depositContract = _exchange.getDepositContract();

        bridge = _bridge;
    }

    function processCalls(BridgeCallGroup[] memory groups)
        external
        payable
        override
        returns (BridgeTransfer[] memory)
    {
        uint numTransfers = 0;
        for (uint g = 0; g < groups.length; g++) {
            numTransfers += groups[g].calls.length;
        }
        BridgeTransfer[] memory transfers = new BridgeTransfer[](numTransfers);
        uint transferIdx = 0;

        // Total ETH to migrate
        uint totalAmountETH = 0;
        BridgeCall memory bridgeCall;
        for (uint g = 0; g < groups.length; g++) {
            GroupSettings memory settings = abi.decode(groups[g].groupData, (GroupSettings));

            BridgeCall[] memory calls = groups[g].calls;

            // Check for each call if the minimum slippage was achieved
            uint totalAmount = 0;
            for (uint i = 0; i < calls.length; i++) {
                bridgeCall = calls[i];
                require(calls[i].token == settings.token, "WRONG_TOKEN_IN_GROUP");

                address to = bridgeCall.owner;
                if(bridgeCall.userData.length == 32) {
                    UserSettings memory userSettings = abi.decode(bridgeCall.userData, (UserSettings));
                    to = userSettings.to;
                }

                transfers[transferIdx++] = BridgeTransfer({
                    owner: to,
                    token: bridgeCall.token,
                    amount: bridgeCall.amount
                });

                totalAmount += bridgeCall.amount;
            }

            if (settings.token == address(0)) {
                totalAmountETH = totalAmountETH.add(totalAmount);
            } else {
                uint allowance = ERC20(settings.token).allowance(address(this), address(depositContract));
                ERC20(settings.token).approve(address(depositContract), allowance.add(totalAmount));
            }
        }

        // Mass migrate
        bridge.batchDeposit{value: totalAmountETH}(transfers);

        return new BridgeTransfer[](0);
    }

    function getMinGasLimit(BridgeCallGroup[] calldata groups)
        external
        pure
        override
        returns (uint gasLimit)
    {
        gasLimit = 40000;
        for (uint g = 0; g < groups.length; g++) {
           gasLimit += 75000 + 2500 * groups[g].calls.length;
        }
    }

    receive()
        external
        payable
    {}
}