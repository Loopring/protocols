// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;


/// @title IPFS
/// @author Brecht Devos - <brecht@loopring.org>
library IPFS
{
    bytes constant ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Encodes the 32 byte data as an IPFS v0 CID
    function encode(uint256 data)
        internal
        pure
        returns (string memory)
    {
        // We'll be always be encoding 34 bytes
        bytes memory out = new bytes(46);

        // Copy alphabet to memory
        bytes memory alphabet = ALPHABET;

        // We have to encode 0x1220data, which is 34 bytes and doesn't fit in a single uint256.
        // Keep the first 32 bytes in the uint, but do the encoding as if 0x1220 was part of the data value.
        // 0 = (0x12200000000000000000000000000000000000000000000000000000000000000000) % 58
        out[45] = alphabet[data % 58];
        data /= 58;
        // 4 = (0x12200000000000000000000000000000000000000000000000000000000000000000 / 58) % 58
        data += 4;
        out[44] = alphabet[data % 58];
        data /= 58;
        // 40 = (0x12200000000000000000000000000000000000000000000000000000000000000000 / 58 / 58) % 58
        data += 40;
        out[43] = alphabet[data % 58];
        data /= 58;

        // Add the top bytes now there is anough space in the uint256
        // This constant is 0x12200000000000000000000000000000000000000000000000000000000000000000 / 58 / 58 / 58
        data += 2753676319555676466672318311740497214108679778017611511045364661305900823779;

        // The rest is just simple base58 encoding
        for (uint i = 3; i < 46; i++) {
            out[45 - i] = alphabet[data % 58];
            data /= 58;
        }

        return string(out);
    }
}
