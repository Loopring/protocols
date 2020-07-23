// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title ILoopring
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract ILoopring is Claimable, ReentrancyGuard
{
    uint    public exchangeCreationCostLRC;
    address public universalRegistry;
    address public lrcAddress;

    event ExchangeInitialized(
        uint    indexed exchangeId,
        address indexed exchangeAddress,
        address indexed owner,
        address         operator,
        bool            rollupMode
    );

    /// @dev Returns the exchange version
    /// @return The exchange version
    function version()
        public
        virtual
        view
        returns (string memory);

    /// @dev Initializes and registers an exchange.
    ///      This function should only be callable by the UniversalRegistry contract.
    ///      Also note that this function can only be called once per exchange instance.
    /// @param  exchangeAddress The address of the exchange to initialize and register.
    /// @param  exchangeId The unique exchange id.
    /// @param  owner The owner of the exchange.
    /// @param  operator The operator of the exchange.
    /// @param  rollupMode True to run in 100% zkRollup mode, false to run in Validium mode.
    ///         Note that this value can not be changed once the exchange is initialized.
    function initializeExchange(
        address exchangeAddress,
        uint    exchangeId,
        address owner,
        address payable operator,
        bool    rollupMode
        )
        external
        virtual;
}
