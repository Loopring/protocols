// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../core/iface/IExchangeV3.sol";
import "../lib/Claimable.sol";
import "../lib/Drainable.sol";
import "../lib/ERC20.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract SinglePhaseConverter is Claimable, Drainable
{
    function swapAndRepay(
        address exchange,
        address swapContract,
        bytes   calldata swapData,
        address swapToken,
        uint    swapAmount,
        address repayToken,
        uint96  repayAmount
        )
        public
    {
        // Swap
        if (swapToken != address(0)) {
            ERC20(swapToken).approve(swapContract, swapAmount);
        }
        (bool success, ) = swapContract.call(swapData);
        require(success, "SWAP_FAILED");

        // Repay
        if (repayToken != address(0)) {
            IDepositContract depositContract = IExchangeV3(exchange).getDepositContract();
            ERC20(repayToken).approve(address(depositContract), repayAmount);
        }
        uint repayValue = (repayToken == address(0)) ? repayAmount : 0;
        IExchangeV3(exchange).repayFlashDeposit{value: repayValue}(
            address(this),
            repayToken,
            repayAmount,
            new bytes(0)
        );
    }

    function canDrain(address drainer, address /* token */)
        public
        override
        view
        returns (bool)
    {
        return drainer == owner;
    }
}
