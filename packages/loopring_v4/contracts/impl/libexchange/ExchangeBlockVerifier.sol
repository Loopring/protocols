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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../thirdparty/Verifier.sol";
import "../../thirdparty/BatchVerifier.sol";
import "../CircuitData.sol";

/// @title Verifies blocks
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBlockVerifier
{
    function verifyProofs(
        CircuitData.VerificationKey memory vk,
        uint[]   memory publicInputs,
        uint[]   memory proofs
        )
        internal
        view
        returns (bool)
    {
        uint[14] memory _vk = [
            vk.data[0], vk.data[1], vk.data[2], vk.data[3], vk.data[4], vk.data[5], vk.data[6],
            vk.data[7], vk.data[8], vk.data[9], vk.data[10], vk.data[11], vk.data[12], vk.data[13]
        ];
        uint[4] memory _vk_gammaABC = [vk.data[14], vk.data[15], vk.data[16], vk.data[17]];

        if (publicInputs.length == 1) {
            return Verifier.Verify(_vk, _vk_gammaABC, proofs, publicInputs);
        } else {
            return BatchVerifier.BatchVerify(
                _vk,
                _vk_gammaABC,
                proofs,
                publicInputs,
                publicInputs.length
            );
        }
    }
}
