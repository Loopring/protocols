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

/// @title Loopring Fingerprint Registry Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract LoopringFingerprintRegistry {

    uint public maxSurvivalBlockCount;

    // ringHash => feeRecepient
    mapping (bytes32 => address) ringHashSubmitters;

    // ringHash => block number
    mapping (bytes32 => uint) ringHashSubmitBlockNumbers;

    function LoopringFingerprintRegistry(uint _maxSurvivalBlockCount) public {
        require(_maxSurvivalBlockCount > 0);
        maxSurvivalBlockCount = _maxSurvivalBlockCount;
    }

    function submitRingFingerprint(
        uint ringSize,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        public {
        bytes32 ringHash = getRingHash(
            ringSize,
            feeRecepient,
            throwIfLRCIsInsuffcient,
            vList,
            rList,
            sList);

        require(canSubmit(ringHash, feeRecepient));
        ringHashSubmitters[ringHash] = feeRecepient;
        ringHashSubmitBlockNumbers[ringHash] = block.number;
    }

    function canSubmit(bytes32 ringHash, address submitter) public constant returns (bool) {
        address priorSubmitter = ringHashSubmitters[ringHash];
        if (priorSubmitter == address(0)) {
            return true;
        } else {
            if (isExpired(ringHash)) {
                return true;
            } else {
                return submitter == priorSubmitter;
            }
        }
    }

    function fingerprintFound(bytes32 ringHash) public constant returns (bool) {
        return ringHashSubmitters[ringHash] != address(0);
    }

    function isExpired(bytes32 ringHash) internal constant returns (bool) {
        uint blockNumber = ringHashSubmitBlockNumbers[ringHash];
        if (blockNumber > 0 && (block.number - blockNumber) > maxSurvivalBlockCount) {
            return true;
        } else {
            return false;
        }
    }

    /// @dev    Calculate the hash of a ring.
    function getRingHash(
        uint ringSize,
        address feeRecepient,
        bool throwIfLRCIsInsuffcient,
        uint8[]     vList,
        bytes32[]   rList,
        bytes32[]   sList)
        public
        constant
        returns (bytes32) {
        require(ringSize == vList.length - 1);
        require(ringSize == rList.length - 1);
        require(ringSize == sList.length - 1);

        uint8 vXor = uint8ArrayXor(vList, ringSize - 1);
        bytes32 rXor = bytes32ArrayXor(rList, ringSize - 1);
        bytes32 sXor = bytes32ArrayXor(sList, ringSize - 1);

        return keccak256(
            feeRecepient,
            throwIfLRCIsInsuffcient,
            vXor,
            rXor,
            sXor);
    }

    function uint8ArrayXor(uint8[] arr, uint len) internal returns (uint8 res) {
        assert(len >= 2 && len <= arr.length);
        for (uint i = 1; i < len; i++) {
            if (i == 1) {
                res = arr[i] ^ arr[i-1];
            } else {
                res = res ^ arr[i];
            }
        }
    }

    function bytes32ArrayXor(bytes32[] bsArr, uint len) internal returns (bytes32 res) {
        assert(len >= 2 && len <= bsArr.length);
        for (uint i = 1; i < len; i++) {
            if (i == 1) {
                res = stringToBytes32(bytes32Xor(bsArr[i-1], bsArr[i]));
            } else {
                res = stringToBytes32(bytes32Xor(res, bsArr[i]));
            }
        }
    }

    function bytes32Xor(bytes32 bs1, bytes32 bs2) internal returns (string) {
        bytes memory res = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            res[i] = bs1[i] ^ bs2[i];
        }
        return string(res);
    }

    function stringToBytes32(string str) internal returns (bytes32 res) {
        assembly {
            res := mload(add(str, 32))
        }
    }

}
