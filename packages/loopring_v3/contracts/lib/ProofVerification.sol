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
pragma solidity 0.5.10;


import "../thirdparty/Verifier.sol";
import "../thirdparty/BatchVerifier.sol";


/// @title ProofVerification
/// @author Brecht Devos - <brecht@loopring.org>
library ProofVerification
{
    function verifyProofs(
        uint[18] memory vk,
        uint[]   memory publicInputs,
        uint[]   memory proofs
        )
        public
        view
        returns (bool)
    {
        uint[14] memory _vk = [
            vk[0], vk[1], vk[2], vk[3], vk[4], vk[5], vk[6],
            vk[7], vk[8], vk[9], vk[10], vk[11], vk[12], vk[13]
        ];
        uint[4] memory _vk_gammaABC = [vk[14], vk[15], vk[16], vk[17]];

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
