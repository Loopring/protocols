// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../amm/LoopringAmmPool.sol";

/// @title LoopringAmmPool
contract LoopringAmmPoolCopy is LoopringAmmPool {
    constructor(
        IAmmController _controller,
        IAssetManager  _assetManager,
        bool           _joinsDisabled
    ) LoopringAmmPool(_controller, _assetManager, _joinsDisabled)
    {}
}
