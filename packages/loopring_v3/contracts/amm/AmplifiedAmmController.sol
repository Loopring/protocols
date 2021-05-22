// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./IAmmController.sol";
import "../amm/LoopringAmmPool.sol";
import "../lib/Claimable.sol";
import "../lib/MathUint.sol";
import "../lib/MathUint96.sol";
import "../thirdparty/SafeCast.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract AmplifiedAmmController is IAmmController, Claimable
{
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    uint public constant AMPLIFICATION_FACTOR_BASE = (10 ** 18);

    mapping(address => uint) public amplificationFactors;

    function getInitialVirtualBalances(
        uint96[] memory joinAmounts
        )
        external
        view
        override
        returns (uint96[] memory)
    {
        uint amplificationFactor = getAmplificationFactor(msg.sender);
        uint96[] memory vTokenBalancesL2 = new uint96[](joinAmounts.length);
        for (uint i = 0; i < joinAmounts.length; i++) {
            vTokenBalancesL2[i] = (uint(joinAmounts[i]).mul(amplificationFactor) / AmmData.AMPLIFICATION_FACTOR_BASE).toUint96();
        }
        return vTokenBalancesL2;
    }

    function getVirtualBalances(
        uint96[] memory /*tokenBalancesL2*/,
        uint96[] memory /*vTokenBalancesL2*/
        )
        external
        pure
        override
        returns (uint96[] memory)
    {
        revert("INVALID_OPERATION");
    }

    function setAmplificationFactor(
        address amm,
        uint    amplificationFactor
        )
        external
        onlyOwner
    {
        amplificationFactors[amm] = amplificationFactor;
    }

    function getAmplificationFactor(address amm)
        public
        view
        returns (uint amplificationFactor)
    {
        amplificationFactor = amplificationFactors[amm];
        if (amplificationFactor == 0) {
            amplificationFactor = AMPLIFICATION_FACTOR_BASE;
        }
    }
}
