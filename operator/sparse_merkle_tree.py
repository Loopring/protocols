# Taken and modified from
# https://github.com/ethereum/research/blob/6ab4a5da40a325c55691dafb6928627fb598e3bd/trie_research/bintrie2/new_bintrie.py

from ethsnarks.merkletree import MerkleHasher_MiMC

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
    def __init__(self, depth):
        assert depth > 1
        self._depth = depth
        self._hasher = MerkleHasher_MiMC(self._depth)
        self._db = EphemDB()
        self._root = 0

    def newTree(self, defaultLeafHash):
        h = defaultLeafHash
        for i in range(self._depth):
            newh = self._hasher.hash_pair(i, h, h)
            self._db.put(newh, [h, h])
            h = newh
        self._root = h

    def get(self, key):
        v = self._root
        path = key
        for i in range(self._depth):
            if (path >> (self._depth - 1)) & 1:
                v = self._db.get(v)[0]
            else:
                v = self._db.get(v)[1]
            path <<= 1
        return v

    def update(self, key, value):
        v = self._root
        path = path2 = key
        sidenodes = []
        for i in range(self._depth):
            if (path >> (self._depth - 1)) & 1:
                sidenodes.append(self._db.get(v)[0])
                v = self._db.get(v)[1]
            else:
                sidenodes.append(self._db.get(v)[1])
                v = self._db.get(v)[0]
            path <<= 1
        v = value
        for i in range(self._depth):
            if (path2 & 1):
                newv = self._hasher.hash_pair(i, sidenodes[-1], v)
                self._db.put(newv, [sidenodes[-1], v])
            else:
                newv = self._hasher.hash_pair(i, v, sidenodes[-1])
                self._db.put(newv, [v, sidenodes[-1]])
            path2 >>= 1
            v = newv
            sidenodes.pop()
        self._root = v

    def createProof(self, key):
        v = self._root
        path = key
        sidenodes = []
        for i in range(self._depth):
            if (path >> (self._depth - 1)) & 1:
                sidenodes.append(self._db.get(v)[0])
                v = self._db.get(v)[1]
            else:
                sidenodes.append(self._db.get(v)[1])
                v = self._db.get(v)[0]
            path <<= 1
        return sidenodes

    def verifyProof(self, proof, key, value):
        path = key
        v = value
        for i in range(self._depth):
            if (path & 1):
                newv = self._hasher.hash_pair(i, proof[-1-i], v)
            else:
                newv = self._hasher.hash_pair(i, v, proof[-1-i])
            path >>= 1
            v = newv
        return self._root == v
