// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./MathUint.sol";
import "../thirdparty/SafeCast.sol";


/// @title Utility Functions for floats
/// @author Brecht Devos - <brecht@loopring.org>
library FloatUtil
{
    using MathUint for uint;
    using SafeCast for uint;

    // Decodes a decimal float value that is encoded like `exponent | mantissa`.
    // Both exponent and mantissa are in base 10.
    // Decoding to an integer is as simple as `mantissa * (10 ** exponent)`
    // Will throw when the decoded value overflows an uint96
    /// @param f The float value with 5 bits for the exponent
    /// @param numBits The total number of bits (numBitsMantissa := numBits - numBitsExponent)
    /// @return value The decoded integer value.
    function decodeFloat(
        uint f,
        uint numBits
        )
        internal
        pure
        returns (uint96 value)
    {
        if (f == 0) {
            return 0;
        }
        uint numBitsMantissa = numBits.sub(5);
        uint exponent = f >> numBitsMantissa;
        // log2(10**77) = 255.79 < 256
        require(exponent <= 77, "EXPONENT_TOO_LARGE");
        uint mantissa = f & ((1 << numBitsMantissa) - 1);
        value = mantissa.mul(10 ** exponent).toUint96();
    }

    // Decodes a decimal float value that is encoded like `exponent | mantissa`.
    // Both exponent and mantissa are in base 10.
    // Decoding to an integer is as simple as `mantissa * (10 ** exponent)`
    // Will throw when the decoded value overflows an uint96
    /// @param f The float value with 5 bits exponent, 11 bits mantissa
    /// @return value The decoded integer value.
    function decodeFloat16(
        uint16 f
        )
        internal
        pure
        returns (uint96)
    {
        uint value = ((uint(f) & 2047) * (10 ** (uint(f) >> 11)));
        require(value < 2**96, "SafeCast: value doesn\'t fit in 96 bits");
        return uint96(value);
    }

    // Decodes a decimal float value that is encoded like `exponent | mantissa`.
    // Both exponent and mantissa are in base 10.
    // Decoding to an integer is as simple as `mantissa * (10 ** exponent)`
    // Will throw when the decoded value overflows an uint96
    /// @param f The float value with 5 bits exponent, 19 bits mantissa
    /// @return value The decoded integer value.
    function decodeFloat24(
        uint24 f
        )
        internal
        pure
        returns (uint96)
    {
        uint value = ((uint(f) & 524287) * (10 ** (uint(f) >> 19)));
        require(value < 2**96, "SafeCast: value doesn\'t fit in 96 bits");
        return uint96(value);
    }

    // Decodes a decimal float value that is encoded like `exponent | mantissa`.
    // Both exponent and mantissa are in base 10.
    // Decoding to an integer is as simple as `mantissa * (10 ** exponent)`
    // Will throw when the decoded value overflows an uint96
    /// @param f The float value with 5 bits exponent, 11 bits mantissa
    /// @return value The decoded integer value.
    function decodeFloat16Unsafe(
        uint f
        )
        internal
        pure
        returns (uint)
    {
        return (f & 2047) * (10 ** (f >> 11));
    }

    // Decodes a decimal float value that is encoded like `exponent | mantissa`.
    // Both exponent and mantissa are in base 10.
    // Decoding to an integer is as simple as `mantissa * (10 ** exponent)`
    // Will throw when the decoded value overflows an uint96
    /// @param f The float value with 5 bits exponent, 19 bits mantissa
    /// @return value The decoded integer value.
    function decodeFloat24Unsafe(
        uint f
        )
        internal
        pure
        returns (uint)
    {
        return (f & 524287) * (10 ** (f >> 19));
    }
}
