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


/// @title IExchangeHelper
/// @author Brecht Devos - <brecht@loopring.org>
contract IExchangeHelper
{

    function verifyAccountBalance(
        uint256 merkleRoot,
        uint24  accountID,
        uint16  tokenID,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot
        )
        external;
}
