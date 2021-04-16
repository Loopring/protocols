// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/MathUint.sol";
import "../../../lib/Poseidon.sol";
import "../../iface/ExchangeData.sol";


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
        public
        pure
    {
        require(
            isAccountBalanceCorrect(merkleRoot, merkleProof),
            "INVALID_MERKLE_TREE_DATA"
        );
    }

    function isAccountBalanceCorrect(
        uint                            merkleRoot,
        ExchangeData.MerkleProof memory merkleProof
        )
        public
        pure
        returns (bool)
    {
        // Calculate the Merkle root using the Merkle paths provided
        uint calculatedRoot = getBalancesRoot(
            merkleProof.balanceLeaf.tokenID,
            merkleProof.balanceLeaf.balance,
            merkleProof.balanceLeaf.weightAMM,
            merkleProof.balanceLeaf.storageRoot,
            merkleProof.balanceMerkleProof
        );
        calculatedRoot = getAccountInternalsRoot(
            merkleProof.accountLeaf.accountID,
            merkleProof.accountLeaf.owner,
            merkleProof.accountLeaf.pubKeyX,
            merkleProof.accountLeaf.pubKeyY,
            merkleProof.accountLeaf.nonce,
            merkleProof.accountLeaf.feeBipsAMM,
            calculatedRoot,
            merkleProof.accountMerkleProof
        );
        // Check against the expected Merkle root
        return (calculatedRoot == merkleRoot);
    }

    function getBalancesRoot(
        uint16   tokenID,
        uint     balance,
        uint     weightAMM,
        uint     storageRoot,
        uint[24] memory balanceMerkleProof
        )
        private
        pure
        returns (uint)
    {
        // Hash the balance leaf
        uint balanceItem = hashImpl(balance, weightAMM, storageRoot, 0);
        // Calculate the Merkle root of the balance quad Merkle tree
        uint _id = tokenID;
        for (uint depth = 0; depth < 8; depth++) {
            uint base = depth * 3;
            if (_id & 3 == 0) {
                balanceItem = hashImpl(
                    balanceItem,
                    balanceMerkleProof[base],
                    balanceMerkleProof[base + 1],
                    balanceMerkleProof[base + 2]
                );
            } else if (_id & 3 == 1) {
                balanceItem = hashImpl(
                    balanceMerkleProof[base],
                    balanceItem,
                    balanceMerkleProof[base + 1],
                    balanceMerkleProof[base + 2]
                );
            } else if (_id & 3 == 2) {
                balanceItem = hashImpl(
                    balanceMerkleProof[base],
                    balanceMerkleProof[base + 1],
                    balanceItem,
                    balanceMerkleProof[base + 2]
                );
            } else if (_id & 3 == 3) {
                balanceItem = hashImpl(
                    balanceMerkleProof[base],
                    balanceMerkleProof[base + 1],
                    balanceMerkleProof[base + 2],
                    balanceItem
                );
            }
            _id = _id >> 2;
        }
        return balanceItem;
    }

    function getAccountInternalsRoot(
        uint32   accountID,
        address  owner,
        uint     pubKeyX,
        uint     pubKeyY,
        uint     nonce,
        uint     feeBipsAMM,
        uint     balancesRoot,
        uint[48] memory accountMerkleProof
        )
        private
        pure
        returns (uint)
    {
        // Hash the account leaf
        uint accountItem = hashAccountLeaf(uint(owner), pubKeyX, pubKeyY, nonce, feeBipsAMM, balancesRoot);
        // Calculate the Merkle root of the account quad Merkle tree
        uint _id = accountID;
        for (uint depth = 0; depth < 16; depth++) {
            uint base = depth * 3;
            if (_id & 3 == 0) {
                accountItem = hashImpl(
                    accountItem,
                    accountMerkleProof[base],
                    accountMerkleProof[base + 1],
                    accountMerkleProof[base + 2]
                );
            } else if (_id & 3 == 1) {
                accountItem = hashImpl(
                    accountMerkleProof[base],
                    accountItem,
                    accountMerkleProof[base + 1],
                    accountMerkleProof[base + 2]
                );
            } else if (_id & 3 == 2) {
                accountItem = hashImpl(
                    accountMerkleProof[base],
                    accountMerkleProof[base + 1],
                    accountItem,
                    accountMerkleProof[base + 2]
                );
            } else if (_id & 3 == 3) {
                accountItem = hashImpl(
                    accountMerkleProof[base],
                    accountMerkleProof[base + 1],
                    accountMerkleProof[base + 2],
                    accountItem
                );
            }
            _id = _id >> 2;
        }
        return accountItem;
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
        return Poseidon.hash_t7f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD);
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
        return Poseidon.hash_t5f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD);
    }
}
