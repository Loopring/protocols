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

        // Total ETH to migrate
        uint totalAmountETH = 0;
        ConnectorTx memory bridgeCall;
        for (uint g = 0; g < groups.length; g++) {
            GroupSettings memory settings = abi.decode(groups[g].groupData, (GroupSettings));

            ConnectorTx[] memory txs = groups[g].transactions;

            // Check for each call if the minimum slippage was achieved
            uint totalAmount = 0;
            for (uint i = 0; i < txs.length; i++) {
                bridgeCall = txs[i];
                require(txs[i].token == settings.token, "WRONG_TOKEN_IN_GROUP");

                address to = bridgeCall.owner;
                if(bridgeCall.userData.length == 32) {
                    UserSettings memory userSettings = abi.decode(bridgeCall.userData, (UserSettings));
                    to = userSettings.to;
                }

                transfers[transferIdx++] = IBatchDepositor.Deposit({
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

        return new IBatchDepositor.Deposit[](0);
    }

    function getMinGasLimit(ConnectorTxGroup[] calldata groups)
        external
        pure
        override
        returns (uint gasLimit)
    {
        gasLimit = 40000;
        for (uint g = 0; g < groups.length; g++) {
           gasLimit += 75000 + 2500 * groups[g].transactions.length;
        }
    }

    receive() external payable {}
}
