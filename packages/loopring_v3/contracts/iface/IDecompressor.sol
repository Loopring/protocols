/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;


/// @title IDecompressor
/// @author Brecht Devos - <brecht@loopring.org>
interface IDecompressor
{
    /// @dev Decompresses the data
    /// @param data The compressed data
    /// @return decompressedData The decompressed data
    function decompress(
        bytes calldata data
        )
        external
        pure
        returns (bytes memory decompressedData);
}
