// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../aux/compression/LzDecompressor.sol";

contract LzDecompressorContract {
    function decompress(
        bytes calldata data
        )
        external
        pure
        returns (bytes memory)
    {
        return LzDecompressor.decompress(data);
    }

    function benchmark(
        bytes calldata data
        )
        external
        pure
        returns (bytes memory)
    {
        return LzDecompressor.decompress(data);
    }
}
