// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/Claimable.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title ILoopring
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract ILoopring is Claimable, ReentrancyGuard
{
    uint    public exchangeCreationCostLRC;
    address public universalRegistry;
    address public lrcAddress;

    event ExchangeInitialized(
        address indexed exchangeAddr,
        address indexed owner,
        bytes32         genesisMerkleRoot
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
    /// @param  exchangeAddr The address of the exchange to initialize and register.
    /// @param  owner The owner of the exchange.
    /// @param  genesisMerkleRoot The initial Merkle tree state.
    function initializeExchange(
        address exchangeAddr,
        address owner,
        bytes32 genesisMerkleRoot
        )
        external
        virtual;
}
