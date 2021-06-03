// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

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

    uint public constant MIN_CURVE_CHANGE_DELAY = 3 days;

    mapping(address => uint) public amplificationFactors;

    mapping(address => uint) public curveChangeAuthorization;


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
            vTokenBalancesL2[i] = (uint(joinAmounts[i]).mul(amplificationFactor) / AMPLIFICATION_FACTOR_BASE).toUint96();
        }
        return vTokenBalancesL2;
    }

   function authorizeVirtualBalances(
        uint96[] memory balances,
        uint96[] memory /*vBalancesOld*/,
        uint96[] memory vBalancesNew,
        bytes    memory /*data*/
        )
        external
        override
        returns (bool)
    {
        uint authorizedTimestamp = curveChangeAuthorization[msg.sender];
        bool authorized = (authorizedTimestamp > 0) && block.timestamp >= curveChangeAuthorization[msg.sender];

        // Remove authorization
        delete curveChangeAuthorization[msg.sender];

        // Special case: Always allow updating the virtual balances if the AF = 1
        if (!authorized && getAmplificationFactor(msg.sender) == AMPLIFICATION_FACTOR_BASE) {
            for (uint i = 0; i < balances.length; i++) {
                if(vBalancesNew[i] != balances[i]) {
                    return false;
                }
            }
        } else {
            return false;
        }

        return true;
    }

    function authorizeCurveChange(address amm)
        external
        onlyOwner
    {
        curveChangeAuthorization[amm] = block.timestamp + MIN_CURVE_CHANGE_DELAY;
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

    function setupPool(
        LoopringAmmPool pool,
        AmmData.PoolConfig calldata config
        )
        external
        onlyOwner
    {
        pool.setupPool(config);
    }

    function enableExitMode(LoopringAmmPool pool)
        external
        onlyOwner
    {
        pool.enableExitMode();
    }
}
