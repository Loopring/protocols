import sys
import json

from sparse_merkle_tree import SparseMerkleTree

from ethsnarks.eddsa import pureeddsa_sign, eddsa_tobits, PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.longsight import LongsightL12p5_MP

TREE_DEPTH_FILLED = 28


class Order(object):
    def __init__(self, publicKey, owner, tokenS, tokenB, tokenF, amountS, amountB, amountF):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.owner = owner
        self.tokenS = tokenS
        self.tokenB = tokenB
        self.tokenF = tokenF
        self.amountS = amountS
        self.amountB = amountB
        self.amountF = amountF

    def message(self):
        msg_parts = [FQ(int(self.owner), 1<<160),
                     FQ(int(self.tokenS), 1<<160), FQ(int(self.tokenB), 1<<160), FQ(int(self.tokenF), 1<<161),
                     FQ(self.amountS, 1<<128), FQ(self.amountB, 1<<128), FQ(self.amountF, 1<<128)]
        return eddsa_tobits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = pureeddsa_sign(msg, k)
        self.hash = PureEdDSA().hash_public(signedMessage.sig.R, signedMessage.A, signedMessage.msg)
        self.sigRx = str(signedMessage.sig.R.x)
        self.sigRy = str(signedMessage.sig.R.y)
        self.sigS = str(signedMessage.sig.s)


class Ring(object):
    def __init__(self, orderA, orderB, fillS_A, fillB_A, fillF_A, fillS_B, fillB_B, fillF_B):
        self.orderA = orderA
        self.orderB = orderB
        self.fillS_A = fillS_A
        self.fillB_A = fillB_A
        self.fillF_A = fillF_A
        self.fillS_B = fillS_B
        self.fillB_B = fillB_B
        self.fillF_B = fillF_B


class Proof(object):
    def __init__(self, merkleRoot, ring, filledA, filledB, proofA, proofB):
        self.merkleRoot = str(merkleRoot)
        self.ring = ring
        self.filledA = filledA
        self.filledB = filledB
        self.proofA = [str(_) for _ in proofA]
        self.proofB = [str(_) for _ in proofB]


class Dex(object):
    def __init__(self):
        self._tree = SparseMerkleTree(TREE_DEPTH_FILLED)
        self._tree.newTree()
        self._filled = {}

    def updateFilled(self, address, fill):
        # Make sure the leaf exist in our map
        if not(address in self._filled):
            self._filled[address] = 0

        filledBefore = self._filled[address]
        self._filled[address] += fill
        proof = self._tree.createProof(address)
        filled_hash = LongsightL12p5_MP([int(self._filled[address]), int(self._filled[address])], 1)
        self._tree.update(address, filled_hash)

        # The circuit expects the proof in the reverse direction from bottom to top
        proof.reverse()
        return (filledBefore, proof)

    def settleRing(self, ring):
        addressA = ring.orderA.hash % (1 << TREE_DEPTH_FILLED)
        addressB = ring.orderB.hash % (1 << TREE_DEPTH_FILLED)

        # Copy the initial merkle root
        merkleRoot = self._tree._root

        # Update filled amounts
        (filledA, proofA) = self.updateFilled(addressA, ring.fillS_A)
        (filledB, proofB) = self.updateFilled(addressB, ring.fillS_B)

        return Proof(merkleRoot, ring, filledA, filledB, proofA, proofB)
