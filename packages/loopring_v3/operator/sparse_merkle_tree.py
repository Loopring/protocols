# Taken and modified from
# https://github.com/ethereum/research/blob/6ab4a5da40a325c55691dafb6928627fb598e3bd/trie_research/bintrie2/new_bintrie.py

from ethsnarks.poseidon import poseidon, poseidon_params
from ethsnarks.field import SNARK_SCALAR_FIELD

poseidonMerkleTreeParams = poseidon_params(SNARK_SCALAR_FIELD, 5, 8, 57, b'poseidon', 5)

class MerkleHasher_Poseidon(object):
    def __init__(self, tree_depth):
        self._tree_depth = tree_depth

    def hash(self, depth, inputs):
        return poseidon(inputs, False, poseidonMerkleTreeParams)

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
    def __init__(self, depth, num_bits = 1):
        assert depth > 1
        self._depth = depth
        self._num_bits = num_bits
        self._num_children = 2 ** num_bits
        self._hasher = MerkleHasher(self._depth)
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
        for i in range(self._depth):
            child_index = (path >> (self._depth * self._num_bits - self._num_bits)) & (self._num_children - 1)
            v = self._db.get(v)[child_index]
            path <<= self._num_bits
        return v

    def update(self, key, value):
        v = self._root
        path = path2 = key
        sidenodes = []
        for i in range(self._depth):
            children = self._db.get(v)
            sidenodes.append(children)
            child_index = (path >> (self._depth * self._num_bits - self._num_bits)) & (self._num_children - 1)
            v = children[child_index]
            path <<= self._num_bits
        v = value
        for i in range(self._depth):
            child_index = path2 & (self._num_children - 1)
            leafs = []
            for c in range(self._num_children):
                if c != child_index:
                    leafs.append(sidenodes[self._depth - 1 - i][c])
                else:
                    leafs.append(v)
            newv = self._hasher.hash(i, leafs)
            self._db.put(newv, leafs)
            path2 >>= self._num_bits
            v = newv
        self._root = v

    def createProof(self, key):
        v = self._root
        path = key
        sidenodes = []
        for i in range(self._depth):
            sidenodes.append([])
            child_index = (path >> (self._depth * self._num_bits - self._num_bits)) & (self._num_children - 1)
            for c in range(self._num_children):
                if c != child_index:
                    sidenodes[i].append(self._db.get(v)[c])
            v = self._db.get(v)[child_index]
            path <<= self._num_bits

        # The circuit expects the proof in the reverse direction from bottom to top
        sidenodes.reverse()
        return [value for sublist in sidenodes for value in sublist]

    #def verifyProof(self, proof, key, value):
    #    path = key
    #    v = value
    #    for i in range(self._depth):
    #        if (path & 1):
    #            newv = self._hasher.hash(i, [proof[-1-i], v])
    #        else:
    #            newv = self._hasher.hash(i, [v, proof[-1-i]])
    #        path >>= self._num_bits
    #        v = newv
    #    return self._root == v
