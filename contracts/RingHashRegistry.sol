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
pragma solidity ^0.4.11;

/// @title Ring Hash Registry Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
import "./lib/Bytes32Lib.sol";
import "./lib/ErrorLib.sol";
import "./lib/Uint8Lib.sol";

contract RinghashRegistry {
    using Bytes32Lib    for bytes32[];
    using ErrorLib      for bool;
    using Uint8Lib      for uint8[];

    uint public blocksToLive;

    struct Submission {
        address feeRecepient;
        uint block;
    }

    mapping (bytes32 => Submission) submissions;

    function RinghashRegistry(uint _blocksToLive) public {
        require(_blocksToLive > 0);
        blocksToLive = _blocksToLive;
    }

    function submitRinghash(
        uint        ringSize,
        address     feeRecepient,
        bool        throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        public {
        bytes32 ringhash = calculateRinghash(
            ringSize,
            feeRecepient,
            throwIfLRCIsInsuffcient,
            vList,
            rList,
            sList);

        canSubmit(ringhash, feeRecepient)
            .orThrow("Ringhash submitted");

        submissions[ringhash] = Submission(feeRecepient, block.number);
    }

    function canSubmit(
        bytes32 ringhash,
        address feeRecepient
        )
        public
        constant
        returns (bool) {

        var submission = submissions[ringhash];
        return (submission.feeRecepient == address(0)
            || submission.block + blocksToLive < block.number
            || submission.feeRecepient == feeRecepient);
    }

    /// @return True if a ring's hash has ever been submitted; false otherwise.
    function ringhashFound(bytes32 ringhash)
        public
        constant
        returns (bool) {

        return submissions[ringhash].feeRecepient != address(0);
    }

    /// @dev Calculate the hash of a ring.
    function calculateRinghash(
        uint        ringSize,
        address     feeRecepient,
        bool        throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        public
        constant
        returns (bytes32) {

        (ringSize == vList.length - 1
            && ringSize == rList.length - 1
            && ringSize == sList.length - 1)
            .orThrow("invalid ring data");

        return keccak256(
            feeRecepient,
            throwIfLRCIsInsuffcient,
            vList.xorReduce(ringSize),
            rList.xorReduce(ringSize),
            sList.xorReduce(ringSize));
    }
}
