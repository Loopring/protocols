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
pragma solidity 0.4.18;

import "./lib/MathBytes32.sol";
import "./lib/MathUint8.sol";


/// @title Ring Hash Registry Contract
/// @dev This contracts help reserve ringhashes for miners.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract RinghashRegistry {
    using MathBytes32   for bytes32[];
    using MathUint8     for uint8[];

    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////
    struct Submission {
        uint64  partnerId;
        uint    block;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////
    uint public blocksToLive;

    mapping (bytes32 => Submission) submissions;


    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event RinghashSubmitted(
        uint64  indexed _parterId,
        bytes32 indexed _ringhash
    );


    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////

    function RinghashRegistry(uint _blocksToLive)
        public
    {
        require(_blocksToLive > 0);
        blocksToLive = _blocksToLive;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Disable default function.
    function () payable public {
        revert();
    }

    function submitRinghash(
        uint64      partnerId,
        bytes32     ringhash
        )
        public
    {
        require(canSubmit(ringhash, partnerId)); //, "Ringhash submitted");

        submissions[ringhash] = Submission(partnerId, block.number);
        RinghashSubmitted(partnerId, ringhash);
    }

    function batchSubmitRinghash(
        uint64[]      partnerIdList,
        bytes32[]     ringhashList
        )
        external
    {
        uint size = partnerIdList.length;
        require(size > 0);
        require(size == ringhashList.length);

        for (uint i = 0; i < size; i++) {
            submitRinghash(partnerIdList[i], ringhashList[i]);
        }
    }

    /// @dev Calculate the hash of a ring.
    function calculateRinghash(
        uint        ringSize,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        private
        pure
        returns (bytes32)
    {
        require(
            ringSize == vList.length - 1 && (
            ringSize == rList.length - 1 && (
            ringSize == sList.length - 1))
        ); //, "invalid ring data");

        return keccak256(
            vList.xorReduce(ringSize),
            rList.xorReduce(ringSize),
            sList.xorReduce(ringSize)
        );
    }

     /// return value attributes[2] contains the following values in this order:
     /// canSubmit, isReserved.
    function computeAndGetRinghashInfo(
        uint        ringSize,
        uint64      partnerId,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList
        )
        external
        view
        returns (bytes32 ringhash, bool[2] attributes)
    {
        ringhash = calculateRinghash(
            ringSize,
            vList,
            rList,
            sList
        );

        attributes[0] = canSubmit(ringhash, partnerId);
        attributes[1] = isReserved(ringhash, partnerId);
    }

    /// @return true if a ring's hash can be submitted;
    /// false otherwise.
    function canSubmit(
        bytes32 ringhash,
        uint64  partnerId)
        public
        view
        returns (bool)
    {
        require(partnerId != 0);
        Submission memory submission = submissions[ringhash];
        uint64 partner = submission.partnerId;
        return (
            partner == 0 || (
            submission.block + blocksToLive < block.number) || (
            partner == partnerId)
        );
    }

    /// @return true if a ring's hash was submitted and still valid;
    /// false otherwise.
    function isReserved(
        bytes32 ringhash,
        uint64  partnerId)
        public
        view
        returns (bool)
    {
        Submission memory submission = submissions[ringhash];
        return (
            submission.block + blocksToLive >= block.number && (
            submission.partnerId == partnerId)
        );
    }
}
