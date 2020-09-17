// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title ZeroDecompressor
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Easy decompressor that compresses runs of zeros.
/// The format is very simple. Each entry consists of
/// (uint16 numDataBytes, uint16 numZeroBytes) which will
/// copy `numDataBytes` data bytes from `data` and will
/// add an additional `numZeroBytes` after it.
library ZeroDecompressor
{
    function decompress(
        bytes calldata /*data*/,
        uint  parameterIdx
        )
        internal
        pure
        returns (bytes memory)
    {
        bytes memory uncompressed;
        uint offsetPos = 4 + 32 * parameterIdx;
        assembly {
            uncompressed := mload(0x40)
            let ptr := add(uncompressed, 32)
            let offset := add(4, calldataload(offsetPos))
            let pos := add(offset, 4)
            let dataLength := add(calldataload(offset), pos)
            let tupple := 0
            let numDataBytes := 0
            let numZeroBytes := 0

            for {} lt(pos, dataLength) {} {
                tupple := and(calldataload(pos), 0xFFFFFFFF)
                numDataBytes := shr(16, tupple)
                numZeroBytes := and(tupple, 0xFFFF)
                calldatacopy(ptr, add(32, pos), numDataBytes)
                pos := add(pos, add(4, numDataBytes))
                ptr := add(ptr, add(numDataBytes, numZeroBytes))
            }

            // Store data length
            mstore(uncompressed, sub(sub(ptr, uncompressed), 32))

            // Update free memory pointer
            mstore(0x40, add(ptr, 0x20))
        }
        return uncompressed;
    }
}
