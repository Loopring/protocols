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
pragma solidity 0.5.7;


/// @title ITransferableMultsig
/// @author Daniel Wang - <daniel@loopring.org>.
contract ITransferableMultsig {
    // Note that address recovered from signatures must be strictly increasing.
    function execute(
        uint8[] calldata   sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        address            destination,
        uint               value,
        bytes calldata     data
        )
        external;

    // Note that address recovered from signatures must be strictly increasing.
    function transferOwnership(
        uint8[] calldata   sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        uint               _threshold,
        address[] calldata _owners
        )
        external;
}
