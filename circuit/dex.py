import sys
import json
import copy


from sparse_merkle_tree import SparseMerkleTree

from ethsnarks.eddsa import pureeddsa_sign, eddsa_tobits, PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.longsight import LongsightL12p5_MP

TREE_DEPTH_TRADING_HISTORY = 28
TREE_DEPTH_ACCOUNTS = 24

class Account(object):
    def __init__(self, secretKey, publicKey, dexID, token, balance):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.dexID = dexID
        self.token = token
        self.balance = balance

    def hash(self):
        #return LongsightL12p5_MP([int(self.publicKeyX), int(self.publicKeyY),
        #                          int(self.dexID), int(self.token), int(self.balance)], 1)
        return LongsightL12p5_MP([int(self.publicKeyX), int(self.publicKeyY), int(self.token), int(self.balance)], 1)

    def fromJSON(self, jAccount):
        self.secretKey = jAccount["secretKey"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.dexID = int(jAccount["dexID"])
        self.token = int(jAccount["token"])
        self.balance = int(jAccount["balance"])


class Order(object):
    def __init__(self, publicKey, dexID, orderID,
                 accountS, accountB, accountF,
                 amountS, amountB, amountF,
                 tokenS, tokenB, tokenF):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.dexID = dexID
        self.orderID = orderID
        self.accountS = accountS
        self.accountB = accountB
        self.accountF = accountF
        self.amountS = amountS
        self.amountB = amountB
        self.amountF = amountF

        self.tokenS = tokenS
        self.tokenB = tokenB
        self.tokenF = tokenF

        self.walletF = 6

    def message(self):
        msg_parts = [
                        FQ(int(self.dexID), 1<<16), FQ(int(self.orderID), 1<<4),
                        FQ(int(self.accountS), 1<<24), FQ(int(self.accountB), 1<<24), FQ(int(self.accountF), 1<<24),
                        FQ(self.amountS, 1<<96), FQ(self.amountB, 1<<96), FQ(self.amountF, 1<<96)
                    ]
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


class RingSettlement(object):
    def __init__(self, tradingHistoryMerkleRoot, accountsMerkleRoot, ring,
                 filledA, filledB, proofA, proofB,
                 accountS_A_before, accountS_A_after, accountS_A_proof,
                 accountB_A_before, accountB_A_after, accountB_A_proof,
                 accountF_A_before, accountF_A_after, accountF_A_proof,
                 accountS_B_before, accountS_B_after, accountS_B_proof,
                 accountB_B_before, accountB_B_after, accountB_B_proof,
                 accountF_B_before, accountF_B_after, accountF_B_proof):
        self.tradingHistoryMerkleRoot = str(tradingHistoryMerkleRoot)
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.ring = ring
        self.filledA = filledA
        self.filledB = filledB
        self.proofA = [str(_) for _ in proofA]
        self.proofB = [str(_) for _ in proofB]

        self.accountS_A_before = accountS_A_before
        self.accountS_A_after = accountS_A_after
        self.accountS_A_proof = [str(_) for _ in accountS_A_proof]
        self.accountB_A_before = accountB_A_before
        self.accountB_A_after = accountB_A_after
        self.accountB_A_proof = [str(_) for _ in accountB_A_proof]
        self.accountF_A_before = accountF_A_before
        self.accountF_A_after = accountF_A_after
        self.accountF_A_proof = [str(_) for _ in accountF_A_proof]

        self.accountS_B_before = accountS_B_before
        self.accountS_B_after = accountS_B_after
        self.accountS_B_proof = [str(_) for _ in accountS_B_proof]
        self.accountB_B_before = accountB_B_before
        self.accountB_B_after = accountB_B_after
        self.accountB_B_proof = [str(_) for _ in accountB_B_proof]
        self.accountF_B_before = accountF_B_before
        self.accountF_B_after = accountF_B_after
        self.accountF_B_proof = [str(_) for _ in accountF_B_proof]


class Dex(object):
    def __init__(self):
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(LongsightL12p5_MP([int(0), int(0)], 1))
        self._filled = {}
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(Account(0, Point(0, 0), 0, 0, 0).hash())
        self._accounts = []

    def loadState(self, filename):
        with open(filename) as f:
            data = json.load(f)
            self._filled = data["trading_history_values"]
            self._tradingHistoryTree._root = data["trading_history_root"]
            self._tradingHistoryTree._db.kv = data["trading_history_tree"]
            for jAccount in data["accounts_values"]:
                account = Account(0, Point(0, 0), 0, 0, 0)
                account.fromJSON(jAccount)
                self._accounts.append(account)
            self._accountsTree._root = data["accounts_root"]
            self._accountsTree._db.kv = data["accounts_tree"]

    def saveState(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "trading_history_values": self._filled,
                    "trading_history_root": self._tradingHistoryTree._root,
                    "trading_history_tree": self._tradingHistoryTree._db.kv,
                    "accounts_values": self._accounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def updateFilled(self, address, fill):
        # Make sure the leaf exist in our map
        if not(str(address) in self._filled):
            self._filled[str(address)] = 0

        filledBefore = self._filled[str(address)]
        print("FilledBefore: " + str(filledBefore))
        self._filled[str(address)] += fill
        print("FilledAfter: " + str(self._filled[str(address)]))
        proof = self._tradingHistoryTree.createProof(address)
        # TODO: don't hash the filled value with itself
        filled_hash = LongsightL12p5_MP([int(self._filled[str(address)]), int(self._filled[str(address)])], 1)
        self._tradingHistoryTree.update(address, filled_hash)

        # The circuit expects the proof in the reverse direction from bottom to top
        proof.reverse()
        return (filledBefore, proof)

    def updateBalance(self, address, amount):
        # Make sure the leaf exist in our map
        if address >= len(self._accounts):
            print("Account doesn't exist: " + str(address))

        accountBefore = copy.deepcopy(self._accounts[address])
        print("accountBefore: " + str(accountBefore.balance))
        self._accounts[address].balance += amount
        accountAfter = self._accounts[address]
        print("accountAfter: " + str(accountAfter.balance))
        proof = self._accountsTree.createProof(address)
        # TODO: don't hash the filled value with itself
        self._accountsTree.update(address, accountAfter.hash())

        # The circuit expects the proof in the reverse direction from bottom to top
        proof.reverse()
        return (accountBefore, accountAfter, proof)

    def settleRing(self, ring):
        addressA = (ring.orderA.accountS << 4) + ring.orderA.orderID
        addressB = (ring.orderB.accountS << 4) + ring.orderB.orderID

        # Copy the initial merkle root
        tradingHistoryMerkleRoot = self._tradingHistoryTree._root
        accountsMerkleRoot = self._accountsTree._root

        # Update filled amounts
        (filledA, proofA) = self.updateFilled(addressA, ring.fillS_A)
        (filledB, proofB) = self.updateFilled(addressB, ring.fillS_B)

        # Update balances A
        (accountS_A_Before, accountS_A_After, accountS_A_proof) = self.updateBalance(ring.orderA.accountS, -ring.fillS_A)
        (accountB_A_Before, accountB_A_After, accountB_A_proof) = self.updateBalance(ring.orderA.accountB, ring.fillB_A)
        (accountF_A_Before, accountF_A_After, accountF_A_proof) = self.updateBalance(ring.orderA.accountF, -ring.fillF_A)

        # Update balances B
        (accountS_B_Before, accountS_B_After, accountS_B_proof) = self.updateBalance(ring.orderB.accountS, -ring.fillS_B)
        (accountB_B_Before, accountB_B_After, accountB_B_proof) = self.updateBalance(ring.orderB.accountB, ring.fillB_B)
        (accountF_B_Before, accountF_B_After, accountF_B_proof) = self.updateBalance(ring.orderB.accountF, -ring.fillF_B)


        return RingSettlement(tradingHistoryMerkleRoot, accountsMerkleRoot,
                              ring, filledA, filledB, proofA, proofB,
                              accountS_A_Before, accountS_A_After, accountS_A_proof,
                              accountB_A_Before, accountB_A_After, accountB_A_proof,
                              accountF_A_Before, accountF_A_After, accountF_A_proof,
                              accountS_B_Before, accountS_B_After, accountS_B_proof,
                              accountB_B_Before, accountB_B_After, accountB_B_proof,
                              accountF_B_Before, accountF_B_After, accountF_B_proof)

    def addAccount(self, account):
        self._accountsTree.update(len(self._accounts), account.hash())
        self._accounts.append(account)

    def getAccount(self, accountID):
        return self._accounts[accountID]
