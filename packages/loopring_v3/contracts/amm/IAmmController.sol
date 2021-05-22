// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @author Brecht Devos - <brecht@loopring.org>
interface IAmmController
{
    function getInitialVirtualBalances(
        uint96[] memory joinAmounts
        )
        external
        view
        returns (uint96[] memory);


    function getVirtualBalances(
        uint96[] memory tokenBalancesL2,
        uint96[] memory vTokenBalancesL2
        )
        external
        view
        returns (uint96[] memory);
}
