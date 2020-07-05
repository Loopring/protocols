// SPDX-License-Identifier: Apache-2.0
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
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../lib/MathUint.sol";
import "../../lib/Poseidon.sol";


/// @title ExchangeBalances.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeBalances
{
    using MathUint  for uint;

    function verifyAccountBalance(
        uint                              merkleRoot,
        ExchangeData.MerkleProof calldata merkleProof
        )
        external
        pure
    {
        bool isCorrect = isAccountBalanceCorrect(
            merkleRoot,
            merkleProof
        );
        require(isCorrect, "INVALID_MERKLE_TREE_DATA");
    }

    function isAccountBalanceCorrect(
        uint                            merkleRoot,
        ExchangeData.MerkleProof memory merkleProof
        )
        public
        pure
        returns (bool isCorrect)
    {
        // Verify data
        uint calculatedRoot = getBalancesRoot(
            merkleProof.balanceLeaf.tokenID,
            merkleProof.balanceLeaf.balance,
            merkleProof.balanceLeaf.index,
            merkleProof.balanceLeaf.tradeHistoryRoot,
            merkleProof.balanceMerkleProof
        );
        calculatedRoot = getAccountInternalsRoot(
            merkleProof.accountLeaf.accountID,
            merkleProof.accountLeaf.owner,
            merkleProof.accountLeaf.pubKeyX,
            merkleProof.accountLeaf.pubKeyY,
            merkleProof.accountLeaf.nonce,
            merkleProof.accountLeaf.walletHash,
            calculatedRoot,
            merkleProof.accountMerkleProof
        );
        isCorrect = (calculatedRoot == merkleRoot);
    }

    function getBalancesRoot(
        uint16   tokenID,
        uint     balance,
        uint     index,
        uint     tradeHistoryRoot,
        uint[18] memory balanceMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint balanceItem = hashImpl(balance, index, tradeHistoryRoot, 0);
        uint _id = tokenID;
        for (uint depth = 0; depth < 6; depth++) {
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
        address  owner,
        uint     pubKeyX,
        uint     pubKeyY,
        uint     nonce,
        uint     walletHash,
        uint     balancesRoot,
        uint[36] memory accountMerkleProof
        )
        private
        pure
        returns (uint)
    {
        uint accountItem = hashAccountLeaf(uint(owner), pubKeyX, pubKeyY, nonce, walletHash, balancesRoot);
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
        Poseidon.HashInputs5 memory inputs = Poseidon.HashInputs5(t0, t1, t2, t3, 0);
        return Poseidon.hash_t5f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }

    function hashAccountLeaf(
        uint t0,
        uint t1,
        uint t2,
        uint t3,
        uint t4,
        uint t5
        )
        public
        pure
        returns (uint)
    {
        Poseidon.HashInputs7 memory inputs = Poseidon.HashInputs7(t0, t1, t2, t3, t4, t5, 0);
        return Poseidon.hash_t7f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }
}
