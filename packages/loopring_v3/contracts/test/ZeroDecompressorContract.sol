// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../aux/compression/ZeroDecompressor.sol";

contract ZeroDecompressorContract {
    function decompress(
        bytes calldata data
        )
        external
        pure
        returns (bytes memory)
    {
        return ZeroDecompressor.decompress(data, 0);
    }

    function benchmark(
        bytes calldata data
        )
        external
        pure
        returns (bytes memory)
    {
        return ZeroDecompressor.decompress(data, 0);
    }
}
