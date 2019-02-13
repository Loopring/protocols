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
pragma solidity 0.5.2;


/// @title ITokenRegistry
/// @author Brecht Devos - <brecht@loopring.org>
contract ITokenRegistry {

    // Burn rates
    uint16 public constant BURNRATE_TIER1            =                       25; // 2.5%
    uint16 public constant BURNRATE_TIER2            =                  15 * 10; //  15%
    uint16 public constant BURNRATE_TIER3            =                  30 * 10; //  30%
    uint16 public constant BURNRATE_TIER4            =                  50 * 10; //  50%

    // Fees
    uint public constant TOKEN_REGISTRATION_FEE_IN_LRC           = 100000 ether;

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16);

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address);

    function getBurnRateMerkleRoot(
        uint burnRateBlockIdx
        )
        external
        view
        returns (bytes32);

}
