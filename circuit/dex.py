import sys
import json
import copy


from sparse_merkle_tree import SparseMerkleTree

from ethsnarks.eddsa import PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.mimc import mimc_hash
from ethsnarks.merkletree import MerkleTree

TREE_DEPTH_TRADING_HISTORY = 28
TREE_DEPTH_ACCOUNTS = 24
TREE_DEPTH_TOKENS = 16

class Account(object):
    def __init__(self, secretKey, publicKey, dexID, token, balance):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.dexID = dexID
        self.token = token
        self.balance = balance

    def hash(self):
        #return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.dexID), int(self.token), int(self.balance)], 1)
        return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.token), int(self.balance)], 1)

    def fromJSON(self, jAccount):
        self.secretKey = jAccount["secretKey"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.dexID = int(jAccount["dexID"])
        self.token = int(jAccount["token"])
        self.balance = int(jAccount["balance"])


class TradeHistoryLeaf(object):
    def __init__(self, filled, cancelled):
        self.filled = str(filled)
        self.cancelled = cancelled

    def hash(self):
        return mimc_hash([int(self.filled), int(self.cancelled)], 1)

    def fromJSON(self, jAccount):
        self.filled = jAccount["filled"]
        self.cancelled = int(jAccount["cancelled"])

class TokenLeaf(object):
    def __init__(self, validUntil, tier):
        self.validUntil = validUntil
        self.tier = tier

    def hash(self):
        return (self.validUntil * 256) + self.tier

    def fromJSON(self, jTokenLeaf):
        self.validUntil = int(jTokenLeaf["validUntil"])
        self.tier = int(jTokenLeaf["tier"])

class TradeHistoryUpdateData(object):
    def __init__(self, before, after, proof):
        self.before = before
        self.after = after
        self.proof = [str(_) for _ in proof]

class AccountUpdateData(object):
    def __init__(self, before, after, proof):
        self.before = before
        self.after = after
        self.proof = [str(_) for _ in proof]

class TokenCheckData(object):
    def __init__(self, tokenData, proof):
        self.tokenData = tokenData
        self.proof = [str(_) for _ in proof]

class Order(object):
    def __init__(self, publicKey, walletPublicKey, dexID, orderID,
                 accountS, accountB, accountF, walletF,
                 amountS, amountB, amountF,
                 tokenS, tokenB, tokenF):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)
        self.dexID = dexID
        self.orderID = orderID
        self.accountS = accountS
        self.accountB = accountB
        self.accountF = accountF
        self.amountS = amountS
        self.amountB = amountB
        self.amountF = amountF

        self.walletF = walletF
        self.tokenS = tokenS
        self.tokenB = tokenB
        self.tokenF = tokenF

    def message(self):
        msg_parts = [
                        FQ(int(self.dexID), 1<<16), FQ(int(self.orderID), 1<<4),
                        FQ(int(self.accountS), 1<<24), FQ(int(self.accountB), 1<<24), FQ(int(self.accountF), 1<<24),
                        FQ(self.amountS, 1<<96), FQ(self.amountB, 1<<96), FQ(self.amountF, 1<<96)
                    ]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
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
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 accountUpdateS_A, accountUpdateB_A, accountUpdateF_A, accountUpdateF_WA, accountUpdateF_BA,
                 accountUpdateS_B, accountUpdateB_B, accountUpdateF_B, accountUpdateF_WB, accountUpdateF_BB,
                 tokenCheckF_A, burnRateF_A, burnFee_A, walletFee_A,
                 tokenCheckF_B, burnRateF_B, burnFee_B, walletFee_B):
        self.tradingHistoryMerkleRoot = str(tradingHistoryMerkleRoot)
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.ring = ring

        self.tradeHistoryUpdate_A = tradeHistoryUpdate_A
        self.tradeHistoryUpdate_B = tradeHistoryUpdate_B

        self.accountUpdateS_A = accountUpdateS_A
        self.accountUpdateB_A = accountUpdateB_A
        self.accountUpdateF_A = accountUpdateF_A
        self.accountUpdateF_WA = accountUpdateF_WA
        self.accountUpdateF_BA = accountUpdateF_BA

        self.accountUpdateS_B = accountUpdateS_B
        self.accountUpdateB_B = accountUpdateB_B
        self.accountUpdateF_B = accountUpdateF_B
        self.accountUpdateF_WB = accountUpdateF_WB
        self.accountUpdateF_BB = accountUpdateF_BB

        self.tokenCheckF_A = tokenCheckF_A
        self.burnRateF_A = burnRateF_A
        self.burnFee_A = burnFee_A
        self.walletFee_A = walletFee_A

        self.tokenCheckF_B = tokenCheckF_B
        self.burnRateF_B = burnRateF_B
        self.burnFee_B = burnFee_B
        self.walletFee_B = walletFee_B


class Deposit(object):
    def __init__(self, accountsMerkleRoot, address, accountUpdate):
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.address = address
        self.accountUpdate = accountUpdate


class Withdrawal(object):
    def __init__(self, accountsMerkleRoot, publicKey, account, amount, accountUpdate):
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.account = account
        self.amount = amount
        self.accountUpdate = accountUpdate

    def message(self):
        msg_parts = [FQ(int(self.account), 1<<24), FQ(int(self.amount), 1<<96), FQ(int(0), 1<<2)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.sigRx = str(signedMessage.sig.R.x)
        self.sigRy = str(signedMessage.sig.R.y)
        self.sigS = str(signedMessage.sig.s)


class Cancellation(object):
    def __init__(self, tradingHistoryMerkleRoot, accountsMerkleRoot,
                 publicKey, account, orderID,
                 tradeHistoryUpdate, accountUpdate):
        self.tradingHistoryMerkleRoot = str(tradingHistoryMerkleRoot)
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.account = account
        self.orderID = orderID
        self.tradeHistoryUpdate = tradeHistoryUpdate
        self.accountUpdate = accountUpdate

    def message(self):
        msg_parts = [FQ(int(self.account), 1<<24), FQ(int(self.orderID), 1<<4), FQ(int(0), 1<<1)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.sigRx = str(signedMessage.sig.R.x)
        self.sigRy = str(signedMessage.sig.R.y)
        self.sigS = str(signedMessage.sig.s)


class Dex(object):
    def __init__(self):
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf(0, 0).hash())
        self._tradeHistoryLeafs = {}
        #print("Empty trading tree: " + str(self._tradingHistoryTree._root))
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(Account(0, Point(0, 0), 0, 0, 0).hash())
        self._accounts = []
        #print("Empty accounts tree: " + str(self._accountsTree._root))
        # Tokens
        self._tokensTree = MerkleTree(1 << 16)
        self._tokens = []

    def loadState(self, filename):
        with open(filename) as f:
            data = json.load(f)
            tradeHistoryLeafsDict = data["trading_history_values"]
            for key, val in tradeHistoryLeafsDict.items():
                self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["cancelled"])
            self._tradingHistoryTree._root = data["trading_history_root"]
            self._tradingHistoryTree._db.kv = data["trading_history_tree"]
            for jAccount in data["accounts_values"]:
                account = Account(0, Point(0, 0), 0, 0, 0)
                account.fromJSON(jAccount)
                self._accounts.append(account)
            self._accountsTree._root = data["accounts_root"]
            self._accountsTree._db.kv = data["accounts_tree"]
            for jTokenLeaf in data["tokens_values"]:
                token = TokenLeaf(0, 0)
                token.fromJSON(jTokenLeaf)
                self._tokens.append(token)
                self._tokensTree.append(token.hash())

    def saveState(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "trading_history_values": self._tradeHistoryLeafs,
                    "trading_history_root": self._tradingHistoryTree._root,
                    "trading_history_tree": self._tradingHistoryTree._db.kv,
                    "accounts_values": self._accounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                    "tokens_values": self._tokens,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def updateTradeHistory(self, address, fill, cancelled = 0):
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            self._tradeHistoryLeafs[str(address)] = TradeHistoryLeaf(0, 0)

        leafBefore = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        #print("leafBefore: " + str(leafBefore))
        self._tradeHistoryLeafs[str(address)].filled = str(int(self._tradeHistoryLeafs[str(address)].filled) + fill)
        self._tradeHistoryLeafs[str(address)].cancelled = cancelled
        leafAfter = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        #print("leafAfter: " + str(leafAfter))
        proof = self._tradingHistoryTree.createProof(address)
        self._tradingHistoryTree.update(address, leafAfter.hash())

        # The circuit expects the proof in the reverse direction from bottom to top
        proof.reverse()
        return TradeHistoryUpdateData(leafBefore, leafAfter, proof)

    def updateBalance(self, address, amount):
        # Make sure the leaf exist in our map
        if address >= len(self._accounts):
            print("Account doesn't exist: " + str(address))

        accountBefore = copy.deepcopy(self._accounts[address])
        #print("accountBefore: " + str(accountBefore.balance))
        self._accounts[address].balance += amount
        accountAfter = copy.deepcopy(self._accounts[address])
        #print("accountAfter: " + str(accountAfter.balance))
        proof = self._accountsTree.createProof(address)
        self._accountsTree.update(address, accountAfter.hash())

        # The circuit expects the proof in the reverse direction from bottom to top
        proof.reverse()
        return AccountUpdateData(accountBefore, accountAfter, proof)

    def checkBurnRate(self, address):
        # Make sure the token exist in the array
        if address >= len(self._tokens):
            print("Token doesn't exist: " + str(address))

        tokenData = copy.deepcopy(self._tokens[address])
        proof = self._tokensTree.proof(address).path

        return TokenCheckData(tokenData, proof)

    def settleRing(self, ring):
        addressA = (ring.orderA.accountS << 4) + ring.orderA.orderID
        addressB = (ring.orderB.accountS << 4) + ring.orderB.orderID

        # Copy the initial merkle root
        tradingHistoryMerkleRoot = self._tradingHistoryTree._root
        accountsMerkleRoot = self._accountsTree._root

        # Update filled amounts
        tradeHistoryUpdate_A = self.updateTradeHistory(addressA, ring.fillS_A)
        tradeHistoryUpdate_B = self.updateTradeHistory(addressB, ring.fillS_B)

        # Check burn rates
        tokenCheckF_A = self.checkBurnRate(ring.orderA.tokenF)
        tokenCheckF_B = self.checkBurnRate(ring.orderB.tokenF)

        burnRateF_A = 10
        burnFee_A = (ring.fillF_A * burnRateF_A) // 100
        walletFee_A = ring.fillF_A - burnFee_A

        burnRateF_B = 10
        burnFee_B = (ring.fillF_B * burnRateF_B) // 100
        walletFee_B = ring.fillF_B - burnFee_B

        #print("burnFee_A: " + str(burnFee_A))
        #print("walletFee_A: " + str(walletFee_A))
        #print("burnFee_B: " + str(burnFee_B))
        #print("walletFee_B: " + str(walletFee_B))

        # Update balances A
        accountUpdateS_A = self.updateBalance(ring.orderA.accountS, -ring.fillS_A)
        accountUpdateB_A = self.updateBalance(ring.orderA.accountB, ring.fillB_A)
        accountUpdateF_A = self.updateBalance(ring.orderA.accountF, -ring.fillF_A)
        accountUpdateF_WA = self.updateBalance(ring.orderA.walletF, walletFee_A)
        accountUpdateF_BA = self.updateBalance(ring.orderA.walletF, burnFee_A)

        # Update balances B
        accountUpdateS_B = self.updateBalance(ring.orderB.accountS, -ring.fillS_B)
        accountUpdateB_B = self.updateBalance(ring.orderB.accountB, ring.fillB_B)
        accountUpdateF_B = self.updateBalance(ring.orderB.accountF, -ring.fillF_B)
        accountUpdateF_WB = self.updateBalance(ring.orderB.walletF, walletFee_B)
        accountUpdateF_BB = self.updateBalance(ring.orderB.walletF, burnFee_B)

        return RingSettlement(tradingHistoryMerkleRoot, accountsMerkleRoot, ring,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              accountUpdateS_A, accountUpdateB_A, accountUpdateF_A, accountUpdateF_WA, accountUpdateF_BA,
                              accountUpdateS_B, accountUpdateB_B, accountUpdateF_B, accountUpdateF_WB, accountUpdateF_BB,
                              tokenCheckF_A, burnRateF_A, burnFee_A, walletFee_A,
                              tokenCheckF_B, burnRateF_B, burnFee_B, walletFee_B)

    def deposit(self, account):
        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        address = len(self._accounts)
        proof = self._accountsTree.createProof(address)

        accountBefore = copy.deepcopy(Account(0, Point(0, 0), 0, 0, 0))
        self._accountsTree.update(address, account.hash())
        accountAfter = copy.deepcopy(account)

        self._accounts.append(account)

        proof.reverse()
        return Deposit(accountsMerkleRoot, address, AccountUpdateData(accountBefore, accountAfter, proof))

    def getAccount(self, accountID):
        return self._accounts[accountID]

    def withdraw(self, address, amount):
        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root
        account = self._accounts[address]
        accountUpdate = self.updateBalance(address, -amount)
        withdrawal = Withdrawal(accountsMerkleRoot, Point(int(account.publicKeyX), int(account.publicKeyY)), address, amount, accountUpdate)
        withdrawal.sign(FQ(int(account.secretKey)))
        return withdrawal

    def cancelOrder(self, accountAddress, orderID):
        account = self._accounts[accountAddress]

        orderAddress = (accountAddress << 4) + orderID

        # Copy the initial merkle roots
        tradingHistoryMerkleRoot = self._tradingHistoryTree._root
        accountsMerkleRoot = self._accountsTree._root

        # Update trading history
        tradeHistoryUpdate = self.updateTradeHistory(orderAddress, 0, 1)

        # Create a proof the signer is the owner of the account
        accountUpdate = self.updateBalance(accountAddress, 0)

        cancellation = Cancellation(tradingHistoryMerkleRoot, accountsMerkleRoot,
                                    Point(int(account.publicKeyX), int(account.publicKeyY)), accountAddress, orderID,
                                    tradeHistoryUpdate, accountUpdate)
        cancellation.sign(FQ(int(account.secretKey)))
        return cancellation

    def addToken(self, validUntil, tier):
        token = TokenLeaf(validUntil, tier)
        address = self._tokensTree.append(token.hash())
        self._tokens.append(token)

        print("Tokens tree root: " + str(hex(self._tokensTree.root)))
