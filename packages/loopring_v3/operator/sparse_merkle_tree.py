# Taken and modified from
# https://github.com/ethereum/research/blob/6ab4a5da40a325c55691dafb6928627fb598e3bd/trie_research/bintrie2/new_bintrie.py

from ethsnarks.poseidon import poseidon, poseidon_params
from ethsnarks.field import SNARK_SCALAR_FIELD

poseidonMerkleTreeParams = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)

class MerkleHasher_Poseidon(object):
    def __init__(self, num_children):
        assert num_children == 4
        self._num_children = num_children

    def hash(self, depth, inputs):
        return poseidon(inputs, poseidonMerkleTreeParams)

MerkleHasher = MerkleHasher_Poseidon

class EphemDB():
    def __init__(self, kv=None):
        self.kv = kv or {}

    def get(self, k):
        return self.kv.get(str(k), None)

    def put(self, k, v):
        self.kv[str(k)] = v

    def delete(self, k):
        del self.kv[str(k)]

class SparseMerkleTree(object):
    def __init__(self, depth, num_children = 2):
        assert depth > 1
        self._depth = depth
        self._num_children = num_children
        self._hasher = MerkleHasher(self._num_children)
        self._db = EphemDB()
        self._root = 0

    def newTree(self, defaultLeafHash):
        h = defaultLeafHash
        for i in range(self._depth):
            newh = self._hasher.hash(i, [h] * self._num_children)
            self._db.put(newh, [h] * self._num_children)
            h = newh
        self._root = h

    def get(self, key):
        v = self._root
        path = key
        for _ in range(self._depth):
            child_index = (path // pow(self._num_children, self._depth - 1)) % self._num_children
            v = self._db.get(v)[child_index]
            path *= self._num_children
        return v

    def update(self, key, value):
        v = self._root
        path = path2 = key
        sidenodes = []
        for i in range(self._depth):
            children = self._db.get(v)
            sidenodes.append(children)
            child_index = (path // pow(self._num_children, self._depth - 1)) % self._num_children
            v = children[child_index]
            path *= self._num_children
        v = value
        for i in range(self._depth):
            child_index = path2 % self._num_children
            leafs = []
            for c in range(self._num_children):
                if c != child_index:
                    leafs.append(sidenodes[self._depth - 1 - i][c])
                else:
                    leafs.append(v)
            newv = self._hasher.hash(i, leafs)
            self._db.put(newv, leafs)
            path2 //= self._num_children
            v = newv
        self._root = v

    def createProof(self, key):
        v = self._root
        path = key
        sidenodes = [[] for _ in range(self._depth)]
        for i in range(self._depth):
            child_index = (path // pow(self._num_children, self._depth - 1)) % self._num_children
            for c in range(self._num_children):
                if c != child_index:
                    sidenodes[self._depth - 1 - i].append(self._db.get(v)[c])
            v = self._db.get(v)[child_index]
            path *= self._num_children
        proof = [value for sublist in sidenodes for value in sublist]
        assert(self.verifyProof(proof, key, v))
        return proof

    def verifyProof(self, proof, key, value):
        path = key
        v = value
        proofIdx = 0
        for i in range(self._depth):
            inputs = []
            for c in range(self._num_children):
                if path % self._num_children == c:
                    inputs.append(v)
                else:
                    inputs.append(proof[proofIdx])
                    proofIdx += 1
            newv = self._hasher.hash(i, inputs)
            path //= self._num_children
            v = newv
        return self._root == v
