// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title LzDecompressor
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Decompresses data compressed with a LZ77/Snappy like compressor optimized for EVM
///      Currently supports 3 modes:
///      - Copy directly from calldata (needs length)
///      - Fill memory with zeros (needs length)
///      - Copy from previously decompressed memory (needs offset, length)
///      TODO:
///      - better packing of (mode, offset, length)
///      - add mode copying from random location in calldata (faster than memory copies)
///      - add support to copy data from memory using the identity pre-compile
///        (large initital cost but cheaper copying, does not support overlapping memory ranges)
library LzDecompressor
{
    function decompress(
        bytes calldata /*data*/
        )
        internal
        pure
        returns (bytes memory)
    {
        bytes memory uncompressed;
        assembly {
            uncompressed := mload(0x40)
            let ptr := add(uncompressed, 32)
            let dataLength := calldataload(36)
            for { let pos := 0 } lt(pos, dataLength) {} {
                // Read the mode
                pos := add(pos, 1)
                let mode := and(calldataload(add(36, pos)), 0xFF)

                switch mode
                case 0 {
                    // Copy from calldata at the current position
                    pos := add(pos, 2)
                    let length := and(calldataload(add(36, pos)), 0xFFFF)

                    calldatacopy(ptr, add(68, pos), length)
                    pos := add(pos, length)

                    ptr := add(ptr, length)
                }
                case 1 {
                    // Write out zeros
                    pos := add(pos, 2)
                    let length := and(calldataload(add(36, pos)), 0xFFFF)

                    codecopy(ptr, codesize(), length)

                    ptr := add(ptr, length)
                }
                case 2 {
                    // Copy from previously decompressed bytes in memory
                    pos := add(pos, 2)
                    let offset := and(calldataload(add(36, pos)), 0xFFFF)
                    pos := add(pos, 2)
                    let length := and(calldataload(add(36, pos)), 0xFFFF)

                    let src := sub(ptr, offset)
                    let i := 0
                    if lt(offset, 32) {
                        // If the offset is less than 32 we can't begin copying 32 bytes at a time.
                        // We first do some copies to fix this
                        mstore(add(src, offset), mload(src))
                        mstore(add(src, mul(offset, 2)), mload(src))
                        mstore(add(src, mul(offset, 4)), mload(src))
                        mstore(add(src, mul(offset, 8)), mload(src))
                        mstore(add(src, mul(offset, 16)), mload(src))
                        mstore(add(src, mul(offset, 32)), mload(src))

                        // No matter the offset, the first 32 bytes can now be copied
                        // Fix the starting data so we can copy like normal afterwards
                        i := 32
                        src := add(sub(src, 32), mod(32, offset))
                    }
                    // This can copy too many bytes, but that's okay
                    // Needs unrolling for the best performance
                    for { } lt(i, length) { } {
                        mstore(add(ptr, i), mload(add(src, i)))
                        i := add(i, 32)
                        mstore(add(ptr, i), mload(add(src, i)))
                        i := add(i, 32)
                        mstore(add(ptr, i), mload(add(src, i)))
                        i := add(i, 32)
                        mstore(add(ptr, i), mload(add(src, i)))
                        i := add(i, 32)
                    }
                    ptr := add(ptr, length)
                }
                default {
                    revert(0, 0)
                }
            }
            // Store data length
            mstore(uncompressed, sub(sub(ptr, uncompressed), 32))

            // Update free memory pointer
            mstore(0x40, add(ptr, 0x20))
        }
        return uncompressed;
    }
}
