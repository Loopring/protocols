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

import "../../lib/MathUint.sol";
import "../../lib/Poseidon.sol";


/// @title ExchangeBalances.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBalances
{
    using MathUint  for uint;

    function verifyAccountBalance(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[36] calldata accountMerkleProof,
        uint[12] calldata balanceMerkleProof
        )
        external
        pure
    {
        bool isCorrect = isAccountBalanceCorrect(
            merkleRoot,
            accountID,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountMerkleProof,
            balanceMerkleProof
        );
        require(isCorrect, "INVALID_MERKLE_TREE_DATA");
    }

    function isAccountBalanceCorrect(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[36] memory accountMerkleProof,
        uint[12] memory balanceMerkleProof
        )
        public
        pure
        returns (bool isCorrect)
    {
        // Verify data
        uint calculatedRoot = getBalancesRoot(
            tokenID,
            balance,
            tradeHistoryRoot,
            balanceMerkleProof
        );
        calculatedRoot = getAccountInternalsRoot(
            accountID,
            pubKeyX,
            pubKeyY,
            nonce,
            calculatedRoot,
            accountMerkleProof
        );
        isCorrect = (calculatedRoot == merkleRoot);
    }

    function getBalancesRoot(
        uint16   tokenID,
        uint     balance,
        uint     tradeHistoryRoot,
        uint[12] memory balanceMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint balanceItem = hashImpl(balance, tradeHistoryRoot, 0, 0);
        uint _id = tokenID;
        for (uint depth = 0; depth < 4; depth++) {
            if (_id & 3 == 0) {
                balanceItem = hashImpl(
                    balanceItem,
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 1) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceItem,
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 2) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceItem,
                    balanceMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 3) {
                balanceItem = hashImpl(
                    balanceMerkleProof[depth * 3],
                    balanceMerkleProof[depth * 3 + 1],
                    balanceMerkleProof[depth * 3 + 2],
                    balanceItem
                );
            }
            _id = _id >> 2;
        }
        return balanceItem;
    }

    function getAccountInternalsRoot(
        uint24   accountID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint     nonce,
        uint     balancesRoot,
        uint[36] memory accountMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint accountItem = hashImpl(pubKeyX, pubKeyY, nonce, balancesRoot);
        uint _id = accountID;
        for (uint depth = 0; depth < 12; depth++) {
            if (_id & 3 == 0) {
                accountItem = hashImpl(
                    accountItem,
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 1) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountItem,
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 2) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountItem,
                    accountMerkleProof[depth * 3 + 2]
                );
            } else if (_id & 3 == 3) {
                accountItem = hashImpl(
                    accountMerkleProof[depth * 3],
                    accountMerkleProof[depth * 3 + 1],
                    accountMerkleProof[depth * 3 + 2],
                    accountItem
                );
            }
            _id = _id >> 2;
        }
        return accountItem;
    }

    function hashImpl(
        uint t0,
        uint t1,
        uint t2,
        uint t3
        )
        private
        pure
        returns (uint)
    {
        return Poseidon.hash_t5f6p52(t0, t1, t2, t3, 0);
    }
}
