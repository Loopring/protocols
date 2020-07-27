// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

interface IDecompressor
{
    /// @param data The compressed data.
    /// @return The decompressed data.
    function decompress(bytes calldata data)
        external
        pure
        returns (bytes memory);
}
