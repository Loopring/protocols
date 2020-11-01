// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/ModuleRegistry.sol";


/// @title Controller
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract Controller
{
    function moduleRegistry()
        external
        view
        virtual
        returns (ModuleRegistry);

    function walletFactory()
        external
        view
        virtual
        returns (address);
}
