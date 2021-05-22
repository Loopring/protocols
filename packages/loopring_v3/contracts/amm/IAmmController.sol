// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @author Brecht Devos - <brecht@loopring.org>
interface IAmmController
{
    /// @dev Called by the pool contract when a join is done on a pool without
    ///      any outstanding LP tokens (so in normal cases an empty pool).
    /// @param joinAmounts The initial amounts in the pool
    function getInitialVirtualBalances(
        uint96[] memory joinAmounts
        )
        external
        view
        returns (uint96[] memory);

    /// @dev Called by the pool contract when a SET_VIRTUAL_BALANCES operation is done
    ///      on the pool.
    /// @param tokenBalancesL2 The balances in the pool
    /// @param vTokenBalancesL2 The current virtual balances in the pool
    /// @return The new virtual balances in the pool
    function getVirtualBalances(
        uint96[] memory tokenBalancesL2,
        uint96[] memory vTokenBalancesL2
        )
        external
        view
        returns (uint96[] memory);
}
