import sys
import json
import copy


from sparse_merkle_tree import SparseMerkleTree

from ethsnarks.eddsa import PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.mimc import mimc_hash
from ethsnarks.merkletree import MerkleTree

TREE_DEPTH_TRADING_HISTORY = 16
TREE_DEPTH_ACCOUNTS = 24
TREE_DEPTH_TOKENS = 16
TREE_DEPTH_BALANCES = 12
TREE_DEPTH_WALLETS = 12
TREE_DEPTH_RINGMATCHERS = 12

def copyBalanceInfo(leaf):
    c = copy.deepcopy(leaf)
    c.tradingHistoryRoot = str(leaf._tradingHistoryTree._root)
    c._tradingHistoryTree = None
    c._tradeHistoryLeafs = None
    return c

def copyAccountInfo(account):
    c = copy.deepcopy(account)
    c.balancesRoot = str(account._balancesTree._root)
    c._balancesTree = None
    c._balancesLeafs = None
    return c

def copyFeeTokenInfo(feeToken):
    c = copy.deepcopy(feeToken)
    c.walletsRoot = str(feeToken._walletsTree._root)
    c._walletsTree = None
    c._wallets = None
    c.ringmatchersRoot = str(feeToken._ringmatchersTree._root)
    c._ringmatchersTree = None
    c._ringmatchers = None
    return c

class Context(object):
    def __init__(self, globalState, operatorAccountID, timestamp):
        self.globalState = globalState
        self.operatorAccountID = int(operatorAccountID)
        self.timestamp = int(timestamp)

class Signature(object):
    def __init__(self, sig):
        self.Rx = str(sig.R.x)
        self.Ry = str(sig.R.y)
        self.s = str(sig.s)


class FeeBalanceLeaf(object):
    def __init__(self, balance = 0):
        self.balance = str(balance)

    def hash(self):
        return int(self.balance)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]


class BalanceLeaf(object):
    def __init__(self, balance = 0):
        self.balance = str(balance)
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}

    def hash(self):
        return mimc_hash([int(self.balance), int(self._tradingHistoryTree._root)], 1)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]
        # Trading history
        tradeHistoryLeafsDict = jBalance["_tradeHistoryLeafs"]
        for key, val in tradeHistoryLeafsDict.items():
            self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["cancelled"])
        self._tradingHistoryTree._root = jBalance["_tradingHistoryTree"]["_root"]
        self._tradingHistoryTree._db.kv = jBalance["_tradingHistoryTree"]["_db"]["kv"]

    def getTradeHistory(self, address):
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            return TradeHistoryLeaf()
        else:
            return self._tradeHistoryLeafs[str(address)]

    def updateTradeHistory(self, address, fill, cancelled):
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            self._tradeHistoryLeafs[str(address)] = TradeHistoryLeaf(0, 0)

        leafBefore = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        rootBefore = self._tradingHistoryTree._root
        #print("leafBefore: " + str(leafBefore))
        self._tradeHistoryLeafs[str(address)].filled = str(int(self._tradeHistoryLeafs[str(address)].filled) + int(fill))
        self._tradeHistoryLeafs[str(address)].cancelled = cancelled
        leafAfter = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        #print("leafAfter: " + str(leafAfter))
        proof = self._tradingHistoryTree.createProof(address)
        self._tradingHistoryTree.update(address, leafAfter.hash())
        rootAfter = self._tradingHistoryTree._root

        return TradeHistoryUpdateData(address, proof,
                                      rootBefore, rootAfter,
                                      leafBefore, leafAfter)


class TradeHistoryLeaf(object):
    def __init__(self, filled = 0, cancelled = 0):
        self.filled = str(filled)
        self.cancelled = cancelled

    def hash(self):
        return mimc_hash([int(self.filled), int(self.cancelled)], 1)

    def fromJSON(self, jAccount):
        self.filled = jAccount["filled"]
        self.cancelled = int(jAccount["cancelled"])


class FeeToken(object):
    def __init__(self):
        self.balance = str(int(0))
        # Wallets
        self._walletsTree = SparseMerkleTree(TREE_DEPTH_WALLETS)
        self._walletsTree.newTree(FeeBalanceLeaf().hash())
        self._wallets = {}
        print("Empty wallets tree: " + str(self._walletsTree._root))
        # Ringmatchers
        self._ringmatchersTree = SparseMerkleTree(TREE_DEPTH_RINGMATCHERS)
        self._ringmatchersTree.newTree(FeeBalanceLeaf().hash())
        self._ringmatchers = {}
        print("Empty ringmatchers tree: " + str(self._ringmatchersTree._root))

    def hash(self):
        return mimc_hash([int(self.balance), int(self._walletsTree._root), int(self._ringmatchersTree._root)], 1)

    def fromJSON(self, jFeeToken):
        self.balance = jFeeToken["balance"]
        # Wallets
        walletsDict = jFeeToken["_wallets"]
        for key, val in walletsDict.items():
            feeBalanceLeaf = FeeBalanceLeaf()
            feeBalanceLeaf.fromJSON(val)
            self._wallets[key] = feeBalanceLeaf
        self._walletsTree._root = jFeeToken["_walletsTree"]["_root"]
        self._walletsTree._db.kv = jFeeToken["_walletsTree"]["_db"]["kv"]
        # Ringmatchers
        ringmatchersDict = jFeeToken["_ringmatchers"]
        for key, val in ringmatchersDict.items():
            feeBalanceLeaf = FeeBalanceLeaf()
            feeBalanceLeaf.fromJSON(val)
            self._ringmatchers[key] = feeBalanceLeaf
        self._ringmatchersTree._root = jFeeToken["_ringmatchersTree"]["_root"]
        self._ringmatchersTree._db.kv = jFeeToken["_ringmatchersTree"]["_db"]["kv"]

    def updateWalletBalance(self, walletID, amount):
        # Make sure the leaf exist in our map
        if not(str(walletID) in self._wallets):
            self._wallets[str(walletID)] = FeeBalanceLeaf()

        balanceBefore = copy.deepcopy(self._wallets[str(walletID)])
        rootBefore = self._walletsTree._root
        self._wallets[str(walletID)].balance = str(int(self._wallets[str(walletID)].balance) + amount)
        balanceAfter = copy.deepcopy(self._wallets[str(walletID)])
        #print("accountAfter: " + str(accountAfter.balance))
        proof = self._walletsTree.createProof(walletID)
        self._walletsTree.update(walletID, self._wallets[str(walletID)].hash())
        rootAfter = self._walletsTree._root

        return FeeBalanceUpdateData(walletID, proof,
                                    rootBefore, rootAfter,
                                    balanceBefore, balanceAfter)

    def updateMinerBalance(self, minerID, amount):
        # Make sure the leaf exist in our map
        if not(str(minerID) in self._ringmatchers):
            self._ringmatchers[str(minerID)] = FeeBalanceLeaf()

        balanceBefore = copy.deepcopy(self._ringmatchers[str(minerID)])
        rootBefore = self._ringmatchersTree._root
        self._ringmatchers[str(minerID)].balance = str(int(self._ringmatchers[str(minerID)].balance) + amount)
        balanceAfter = copy.deepcopy(self._ringmatchers[str(minerID)])
        #print("accountAfter: " + str(accountAfter.balance))
        proof = self._ringmatchersTree.createProof(minerID)
        self._ringmatchersTree.update(minerID, self._ringmatchers[str(minerID)].hash())
        rootAfter = self._ringmatchersTree._root

        return FeeBalanceUpdateData(minerID, proof,
                                    rootBefore, rootAfter,
                                    balanceBefore, balanceAfter)


class Account(object):
    def __init__(self, secretKey, publicKey, walletID):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletID = walletID
        self.nonce = 0
        #print("Empty trading tree: " + str(self._tradingHistoryTree._root))
        # Balances
        self._balancesTree = SparseMerkleTree(TREE_DEPTH_BALANCES)
        self._balancesTree.newTree(BalanceLeaf().hash())
        self._balancesLeafs = {}
        #print("Empty balances tree: " + str(self._balancesTree._root))

    def hash(self):
        return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.walletID), int(self.nonce), int(self._balancesTree._root)], 1)

    def fromJSON(self, jAccount):
        self.secretKey = jAccount["secretKey"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.walletID = int(jAccount["walletID"])
        self.nonce = int(jAccount["nonce"])
        # Balances
        balancesLeafsDict = jAccount["_balancesLeafs"]
        for key, val in balancesLeafsDict.items():
            balanceLeaf = BalanceLeaf()
            balanceLeaf.fromJSON(val)
            self._balancesLeafs[key] = balanceLeaf
        self._balancesTree._root = jAccount["_balancesTree"]["_root"]
        self._balancesTree._db.kv = jAccount["_balancesTree"]["_db"]["kv"]

    def getBalance(self, address):
        # Make sure the leaf exist in our map
        if not(str(address) in self._balancesLeafs):
            return int(0)
        else:
            return self._balancesLeafs[str(address)].balance

    def updateBalance(self, tokenID, amount):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + amount)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter)

    def updateBalanceAndTradeHistory(self, tokenID, orderID, amount):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update filled amounts
        tradeHistory = self._balancesLeafs[str(tokenID)].getTradeHistory(orderID)
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, -amount, tradeHistory.cancelled)
        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + amount)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return (BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter),
                tradeHistoryUpdate)

    def cancelOrder(self, tokenID, orderID):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update cancelled state
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, 0, 1)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return (BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter),
                tradeHistoryUpdate)


class BurnRateLeaf(object):
    def __init__(self, burnRate):
        self.burnRate = burnRate

    def hash(self):
        return self.burnRate

    def fromJSON(self, jBurnRateLeaf):
        self.burnRate = int(jBurnRateLeaf["burnRate"])

class TradeHistoryUpdateData(object):
    def __init__(self,
                 orderID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.orderID = int(orderID)
        self.proof = [str(_) for _ in proof]
        self.rootBefore = str(rootBefore)
        self.rootAfter = str(rootAfter)
        self.before = before
        self.after = after

class BalanceUpdateData(object):
    def __init__(self,
                 tokenID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.tokenID = int(tokenID)
        self.proof = [str(_) for _ in proof]
        self.rootBefore = str(rootBefore)
        self.rootAfter = str(rootAfter)
        self.before = before
        self.after = after

class AccountUpdateData(object):
    def __init__(self,
                 accountID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.accountID = int(accountID)
        self.proof = [str(_) for _ in proof]
        self.rootBefore = str(rootBefore)
        self.rootAfter = str(rootAfter)
        self.before = before
        self.after = after

class FeeTokenUpdateData(object):
    def __init__(self,
                 tokenID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.tokenID = int(tokenID)
        self.proof = [str(_) for _ in proof]
        self.rootBefore = str(rootBefore)
        self.rootAfter = str(rootAfter)
        self.before = before
        self.after = after

class FeeBalanceUpdateData(object):
    def __init__(self,
                 ID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.ID = int(ID)
        self.proof = [str(_) for _ in proof]
        self.rootBefore = str(rootBefore)
        self.rootAfter = str(rootAfter)
        self.before = before
        self.after = after


class BurnRateCheckData(object):
    def __init__(self, burnRateData, proof):
        self.burnRateData = burnRateData
        self.proof = [str(_) for _ in proof]


class Deposit(object):
    def __init__(self, balanceUpdate, accountUpdate):
        self.balanceUpdate = balanceUpdate
        self.accountUpdate = accountUpdate

class Order(object):
    def __init__(self,
                 publicKey, walletPublicKey,
                 stateID, walletID, orderID, accountID, dualAuthAccountID,
                 tokenS, tokenB, tokenF,
                 amountS, amountB, amountF,
                 allOrNone, validSince, validUntil,
                 walletSplitPercentage, waiveFeePercentage):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)

        self.stateID = int(stateID)
        self.walletID = int(walletID)
        self.orderID = int(orderID)
        self.accountID = int(accountID)
        self.dualAuthAccountID = int(dualAuthAccountID)

        self.amountS = str(amountS)
        self.amountB = str(amountB)
        self.amountF = str(amountF)

        self.tokenS = tokenS
        self.tokenB = tokenB
        self.tokenF = tokenF

        self.allOrNone = bool(allOrNone)
        self.validSince = validSince
        self.validUntil = validUntil
        self.walletSplitPercentage = walletSplitPercentage
        self.waiveFeePercentage = waiveFeePercentage


    def message(self):
        msg_parts = [
                        FQ(int(self.stateID), 1<<16), FQ(int(self.walletID), 1<<12), FQ(int(self.orderID), 1<<16),
                        FQ(int(self.accountID), 1<<24), FQ(int(self.dualAuthAccountID), 1<<24),
                        FQ(int(self.tokenS), 1<<12), FQ(int(self.tokenB), 1<<12), FQ(int(self.tokenF), 1<<12),
                        FQ(int(self.amountS), 1<<96), FQ(int(self.amountB), 1<<96), FQ(int(self.amountF), 1<<96),
                        FQ(int(self.allOrNone), 1<<1), FQ(int(self.validSince), 1<<32), FQ(int(self.validUntil), 1<<32),
                        FQ(int(self.walletSplitPercentage), 1<<7)
                    ]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.hash = PureEdDSA().hash_public(signedMessage.sig.R, signedMessage.A, signedMessage.msg)
        self.signature = Signature(signedMessage.sig)

    def checkValid(self, context):
        valid = True
        valid = valid and (self.validSince <= context.timestamp)
        valid = valid and (context.timestamp <= self.validUntil)
        self.valid = valid

    def checkFills(self, fillAmountS, fillAmountB):
        if self.allOrNone and fillAmountS != int(self.amountS):
            valid = False
        else:
            valid = True
        return valid


class Ring(object):
    def __init__(self, orderA, orderB, publicKey, minerID, minerAccountID, fee, nonce):
        self.orderA = orderA
        self.orderB = orderB
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.minerID = minerID
        self.minerAccountID = minerAccountID
        self.fee = fee
        self.nonce = nonce

    def message(self):
        msg_parts = [
                        FQ(int(self.orderA.hash), 1<<254), FQ(int(self.orderB.hash), 1<<254),
                        FQ(int(self.orderA.waiveFeePercentage), 1<<7), FQ(int(self.orderB.waiveFeePercentage), 1<<7),
                        FQ(int(self.minerID), 1<<12), FQ(int(self.minerAccountID), 1<<24),
                        FQ(int(self.fee), 1<<96),
                        FQ(int(self.nonce), 1<<32)
                    ]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, miner_k, walletA_k, walletB_k):
        msg = self.message()
        # miner
        signedMessage = PureEdDSA.sign(msg, miner_k)
        self.minerSignature = Signature(signedMessage.sig)
        # walletA
        signedMessage = PureEdDSA.sign(msg, walletA_k)
        self.walletASignature = Signature(signedMessage.sig)
        # walletB
        signedMessage = PureEdDSA.sign(msg, walletB_k)
        self.walletBSignature = Signature(signedMessage.sig)

class RingSettlement(object):
    def __init__(self,
                 ring,
                 accountsMerkleRoot, feesMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, balanceUpdateF_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, balanceUpdateF_B, accountUpdate_B,
                 balanceUpdate_M, accountUpdate_M,
                 feeBalanceUpdateF_WA, feeBalanceUpdateF_MA, feeTokenUpdate_FA,
                 feeBalanceUpdateF_WB, feeBalanceUpdateF_MB, feeTokenUpdate_FB,
                 feeBalanceUpdateS_MA, feeTokenUpdate_SA,
                 burnRateCheckF_A, walletFee_A, matchingFee_A, burnFee_A,
                 burnRateCheckF_B, walletFee_B, matchingFee_B, burnFee_B):
        self.ring = ring

        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.feesMerkleRoot = str(feesMerkleRoot)

        self.tradeHistoryUpdate_A = tradeHistoryUpdate_A
        self.tradeHistoryUpdate_B = tradeHistoryUpdate_B

        self.balanceUpdateS_A = balanceUpdateS_A
        self.balanceUpdateB_A = balanceUpdateB_A
        self.balanceUpdateF_A = balanceUpdateF_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateS_B = balanceUpdateS_B
        self.balanceUpdateB_B = balanceUpdateB_B
        self.balanceUpdateF_B = balanceUpdateF_B
        self.accountUpdate_B = accountUpdate_B

        self.balanceUpdate_M = balanceUpdate_M
        self.accountUpdate_M = accountUpdate_M

        self.feeBalanceUpdateF_WA = feeBalanceUpdateF_WA
        self.feeBalanceUpdateF_MA = feeBalanceUpdateF_MA
        self.feeTokenUpdate_FA = feeTokenUpdate_FA

        self.feeBalanceUpdateF_WB = feeBalanceUpdateF_WB
        self.feeBalanceUpdateF_MB = feeBalanceUpdateF_MB
        self.feeTokenUpdate_FB = feeTokenUpdate_FB

        self.feeBalanceUpdateS_MA = feeBalanceUpdateS_MA
        self.feeTokenUpdate_SA = feeTokenUpdate_SA

        self.burnRateCheckF_A = burnRateCheckF_A
        self.walletFee_A = walletFee_A
        self.matchingFee_A = matchingFee_A
        self.burnFee_A = burnFee_A

        self.burnRateCheckF_B = burnRateCheckF_B
        self.walletFee_B = walletFee_B
        self.matchingFee_B = matchingFee_B
        self.burnFee_B = burnFee_B


class Withdrawal(object):
    def __init__(self,
                 publicKey,
                 accountID, tokenID, amount,
                 amountWithdrawn, balanceUpdate, accountUpdate):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.accountID = accountID
        self.tokenID = tokenID
        self.amount = str(amount)
        self.amountWithdrawn = str(amountWithdrawn)
        self.balanceUpdate = balanceUpdate
        self.accountUpdate = accountUpdate

    def message(self):
        msg_parts = [FQ(int(self.accountID), 1<<24), FQ(int(self.tokenID), 1<<12), FQ(int(self.amount), 1<<96), FQ(int(0), 1<<2)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)


class Cancellation(object):
    def __init__(self,
                 publicKey,
                 accountID, tokenID, orderID,
                 nonce,
                 tradeHistoryUpdate, balanceUpdate, accountUpdate):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.accountID = accountID
        self.tokenID = tokenID
        self.orderID = orderID
        self.nonce = nonce
        self.tradeHistoryUpdate = tradeHistoryUpdate
        self.balanceUpdate = balanceUpdate
        self.accountUpdate = accountUpdate

    def message(self):
        msg_parts = [FQ(int(self.accountID), 1<<24), FQ(int(self.tokenID), 1<<12), FQ(int(self.orderID), 1<<16),
                     FQ(int(self.nonce), 1<<32), FQ(int(0), 1<<2)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)


class GlobalState(object):
    def __init__(self):
        self._tokensTree = MerkleTree(1 << 16)
        self._tokens = []

    def load(self, filename):
        with open(filename) as f:
            data = json.load(f)
            for jBurnRateLeaf in data["tokens_values"]:
                token = BurnRateLeaf(0)
                token.fromJSON(jBurnRateLeaf)
                self._tokens.append(token)
                self._tokensTree.append(token.hash())

    def save(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "tokens_values": self._tokens,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def checkBurnRate(self, address):
        # Make sure the token exist in the array
        if address >= len(self._tokens):
            print("Token doesn't exist: " + str(address))

        print("burn address: " + str(address))
        burnRateData = copy.deepcopy(self._tokens[address])
        proof = self._tokensTree.proof(address).path

        return BurnRateCheckData(burnRateData, proof)

    def addToken(self, burnRate):
        token = BurnRateLeaf(burnRate)
        # address = self._tokensTree.append(token.hash())
        self._tokens.append(token)

        # print("Tokens tree root: " + str(hex(self._tokensTree.root)))


class State(object):
    def __init__(self, stateID):
        self.stateID = int(stateID)
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(Account(0, Point(0, 0), 0).hash())
        self._accounts = {}
        print("Empty accounts tree: " + str(hex(self._accountsTree._root)))
        # FeeBalances
        self._feeTokensTree = SparseMerkleTree(TREE_DEPTH_BALANCES)
        self._feeTokensTree.newTree(FeeToken().hash())
        self._feeTokens = {}
        print("Empty feeTokens tree: " + str(hex(self._feeTokensTree._root)))
        print("Empty merkle tree: " + str(hex(self.getRoot())))

    def load(self, filename):
        with open(filename) as f:
            data = json.load(f)
            self.stateID = int(data["stateID"])
            # Accounts
            accountLeafsDict = data["accounts_values"]
            for key, val in accountLeafsDict.items():
                account = Account(0, Point(0, 0), 0)
                account.fromJSON(val)
                self._accounts[key] = account
            self._accountsTree._root = data["accounts_root"]
            self._accountsTree._db.kv = data["accounts_tree"]
            # FeeTokens
            feeTokensDict = data["feeToken_values"]
            for key, val in feeTokensDict.items():
                feeToken = FeeToken()
                feeToken.fromJSON(val)
                self._feeTokens[key] = feeToken
            self._feeTokensTree._root = data["feeTokens_root"]
            self._feeTokensTree._db.kv = data["feeTokens_tree"]

    def save(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "stateID": self.stateID,
                    "accounts_values": self._accounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                    "feeToken_values": self._feeTokens,
                    "feeTokens_root": self._feeTokensTree._root,
                    "feeTokens_tree": self._feeTokensTree._db.kv,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def calculateFees(self, fee, burnRate, walletSplitPercentage, waiveFeePercentage):
        walletFee = (fee * walletSplitPercentage) // 100
        matchingFee = fee - walletFee

        walletFeeToBurn = (walletFee * burnRate) // 1000
        walletFeeToPay = walletFee - walletFeeToBurn

        matchingFeeAfterWaiving = (matchingFee * waiveFeePercentage) // 100
        matchingFeeToBurn = (matchingFeeAfterWaiving * burnRate) // 1000
        matchingFeeToPay = matchingFeeAfterWaiving - matchingFeeToBurn

        feeToBurn = walletFeeToBurn + matchingFeeToBurn

        return (walletFeeToPay, matchingFeeToPay, feeToBurn)

    def getMaxFillAmounts(self, order):
        account = self.getAccount(order.accountID)
        tradeHistory = account._balancesLeafs[str(order.tokenS)].getTradeHistory(order.orderID)
        order.filledBefore = str(tradeHistory.filled)
        order.cancelled = int(tradeHistory.cancelled)
        order.balanceS = str(account.getBalance(order.tokenS))
        order.balanceB = str(account.getBalance(order.tokenB))
        order.balanceF = str(account.getBalance(order.tokenF))

        balanceS = int(account.getBalance(order.tokenS))
        remainingS = int(order.amountS) - int(order.filledBefore)
        if order.cancelled == 1:
            remainingS = 0
        fillAmountS = balanceS if (balanceS < remainingS) else remainingS
        fillAmountB = (fillAmountS * int(order.amountB)) // int(order.amountS)
        return (fillAmountS, fillAmountB)

    def settleRing(self, context, ring):
        (fillAmountS_A, fillAmountB_A) = self.getMaxFillAmounts(ring.orderA)
        (fillAmountS_B, fillAmountB_B) = self.getMaxFillAmounts(ring.orderB)

        print("mfillAmountS_A: " + str(fillAmountS_A))
        print("mfillAmountB_A: " + str(fillAmountB_A))
        print("mfillAmountS_B: " + str(fillAmountS_B))
        print("mfillAmountB_B: " + str(fillAmountB_B))

        if fillAmountB_A < fillAmountS_B:
            fillAmountB_B = fillAmountS_A
            fillAmountS_B = (fillAmountB_B * int(ring.orderB.amountS)) // int(ring.orderB.amountB)
        else:
            fillAmountB_A = fillAmountS_B
            fillAmountS_A = (fillAmountB_A * int(ring.orderA.amountS)) // int(ring.orderA.amountB)

        margin = fillAmountS_A - fillAmountB_B

        ring.valid = True
        if fillAmountS_A < fillAmountB_B:
            print("fills false: ")
            ring.valid = False

        ring.orderA.checkValid(context)
        ring.orderB.checkValid(context)
        fillsValidA = ring.orderA.checkFills(fillAmountS_A, fillAmountB_A)
        fillsValidB = ring.orderB.checkFills(fillAmountS_B, fillAmountB_B)
        ring.valid = ring.valid and ring.orderA.valid and ring.orderB.valid and fillsValidA and fillsValidB

        print("ring.orderA.valid " + str(ring.orderA.valid))
        print("ring.orderB.valid " + str(ring.orderB.valid))
        print("fillsValidA " + str(fillsValidA))
        print("fillsValidB " + str(fillsValidB))

        if ring.valid == False:
            print("ring.valid false: ")
            fillAmountS_A = 0
            fillAmountB_A = 0
            fillAmountS_B = 0
            fillAmountB_B = 0
            margin = 0

        fillAmountF_A = (int(ring.orderA.amountF) * fillAmountS_A) // int(ring.orderA.amountS)
        fillAmountF_B = (int(ring.orderB.amountF) * fillAmountS_B) // int(ring.orderB.amountS)

        ring.fillS_A = str(fillAmountS_A)
        ring.fillB_A = str(fillAmountB_A)
        ring.fillF_A = str(fillAmountF_A)

        ring.fillS_B = str(fillAmountS_B)
        ring.fillB_B = str(fillAmountB_B)
        ring.fillF_B = str(fillAmountF_B)

        ring.margin = str(margin)

        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountF_A: " + str(fillAmountF_A))

        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("fillAmountF_B: " + str(fillAmountF_B))

        print("margin: " + str(margin))

        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root
        feesMerkleRoot = self._feeTokensTree._root

        # Accounts
        accountA = self.getAccount(ring.orderA.accountID)
        accountB = self.getAccount(ring.orderB.accountID)
        accountM = self.getAccount(ring.minerAccountID)

        # Check burn rates
        burnRateCheckF_A = context.globalState.checkBurnRate(ring.orderA.tokenF)
        burnRateCheckF_B = context.globalState.checkBurnRate(ring.orderB.tokenF)

        (walletFee_A, matchingFee_A, burnFee_A) = self.calculateFees(
            int(ring.fillF_A),
            burnRateCheckF_A.burnRateData.burnRate,
            ring.orderA.walletSplitPercentage,
            ring.orderA.waiveFeePercentage
        )

        (walletFee_B, matchingFee_B, burnFee_B) = self.calculateFees(
            int(ring.fillF_B),
            burnRateCheckF_B.burnRateData.burnRate,
            ring.orderB.walletSplitPercentage,
            ring.orderB.waiveFeePercentage
        )

        print("walletFee_A: " + str(walletFee_A))
        print("matchingFee_A: " + str(matchingFee_A))
        print("burnFee_A: " + str(burnFee_A))

        print("walletFee_B: " + str(walletFee_B))
        print("matchingFee_B: " + str(matchingFee_B))
        print("burnFee_B: " + str(burnFee_B))

        # Update balances A
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        proof = self._accountsTree.createProof(ring.orderA.accountID)

        (balanceUpdateS_A, tradeHistoryUpdate_A) = accountA.updateBalanceAndTradeHistory(ring.orderA.tokenS, ring.orderA.orderID, -int(ring.fillS_A))
        balanceUpdateB_A = accountA.updateBalance(ring.orderA.tokenB, int(ring.fillB_A))
        balanceUpdateF_A = accountA.updateBalance(ring.orderA.tokenF, -(walletFee_A + matchingFee_A + burnFee_A))

        self.updateAccountTree(ring.orderA.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(ring.orderA.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Update balances B
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        proof = self._accountsTree.createProof(ring.orderB.accountID)

        (balanceUpdateS_B, tradeHistoryUpdate_B) = accountB.updateBalanceAndTradeHistory(ring.orderB.tokenS, ring.orderB.orderID, -int(ring.fillS_B))
        balanceUpdateB_B = accountB.updateBalance(ring.orderB.tokenB, int(ring.fillB_B))
        balanceUpdateF_B = accountB.updateBalance(ring.orderB.tokenF, -(walletFee_B + matchingFee_B + burnFee_B))

        self.updateAccountTree(ring.orderB.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(ring.orderB.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Operator payment
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.minerAccountID))
        proof = self._accountsTree.createProof(ring.minerAccountID)

        balanceUpdate_M = accountM.updateBalance(1, -int(ring.fee))

        self.updateAccountTree(ring.minerAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.minerAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_M = AccountUpdateData(ring.minerAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Update orderA fees
        rootBefore = self._feeTokensTree._root
        feeTokenBefore = copyFeeTokenInfo(self.getFeeToken(ring.orderA.tokenF))
        proof = self._feeTokensTree.createProof(ring.orderA.tokenF)

        feeBalanceUpdateF_WA = self.getFeeToken(ring.orderA.tokenF).updateWalletBalance(ring.orderA.walletID, walletFee_A)
        feeBalanceUpdateF_MA = self.getFeeToken(ring.orderA.tokenF).updateMinerBalance(ring.minerID, matchingFee_A)
        self.updateBurnBalance(ring.orderA.tokenF, burnFee_A)

        self.updateFeeTokensTree(ring.orderA.tokenF)
        feeTokenAfter = copyFeeTokenInfo(self.getFeeToken(ring.orderA.tokenF))
        rootAfter = self._feeTokensTree._root
        feeTokenUpdate_FA = FeeTokenUpdateData(ring.orderA.tokenF, proof, rootBefore, rootAfter, feeTokenBefore, feeTokenAfter)

         # Update orderB fees
        rootBefore = self._feeTokensTree._root
        feeTokenBefore = copyFeeTokenInfo(self.getFeeToken(ring.orderB.tokenF))
        proof = self._feeTokensTree.createProof(ring.orderB.tokenF)

        feeBalanceUpdateF_WB = self.getFeeToken(ring.orderB.tokenF).updateWalletBalance(ring.orderB.walletID, walletFee_B)
        feeBalanceUpdateF_MB = self.getFeeToken(ring.orderB.tokenF).updateMinerBalance(ring.minerID, matchingFee_B)
        self.updateBurnBalance(ring.orderB.tokenF, burnFee_B)

        self.updateFeeTokensTree(ring.orderB.tokenF)
        feeTokenAfter = copyFeeTokenInfo(self.getFeeToken(ring.orderB.tokenF))
        rootAfter = self._feeTokensTree._root
        feeTokenUpdate_FB = FeeTokenUpdateData(ring.orderB.tokenF, proof, rootBefore, rootAfter, feeTokenBefore, feeTokenAfter)

        # Margin
        rootBefore = self._feeTokensTree._root
        feeTokenBefore = copyFeeTokenInfo(self.getFeeToken(ring.orderA.tokenS))
        proof = self._feeTokensTree.createProof(ring.orderA.tokenS)

        feeBalanceUpdateS_MA = self.getFeeToken(ring.orderA.tokenS).updateMinerBalance(ring.minerID, int(ring.margin))

        self.updateFeeTokensTree(ring.orderA.tokenS)
        feeTokenAfter = copyFeeTokenInfo(self.getFeeToken(ring.orderA.tokenS))
        rootAfter = self._feeTokensTree._root
        feeTokenUpdate_SA = FeeTokenUpdateData(ring.orderA.tokenS, proof, rootBefore, rootAfter, feeTokenBefore, feeTokenAfter)


        return RingSettlement(ring,
                              accountsMerkleRoot, feesMerkleRoot,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              balanceUpdateS_A, balanceUpdateB_A, balanceUpdateF_A, accountUpdate_A,
                              balanceUpdateS_B, balanceUpdateB_B, balanceUpdateF_B, accountUpdate_B,
                              balanceUpdate_M, accountUpdate_M,
                              feeBalanceUpdateF_WA, feeBalanceUpdateF_MA, feeTokenUpdate_FA,
                              feeBalanceUpdateF_WB, feeBalanceUpdateF_MB, feeTokenUpdate_FB,
                              feeBalanceUpdateS_MA, feeTokenUpdate_SA,
                              burnRateCheckF_A, walletFee_A, matchingFee_A, burnFee_A,
                              burnRateCheckF_B, walletFee_B, matchingFee_B, burnFee_B)


    def deposit(self, accountID, secretKey, publicKeyX, publicKeyY, walletID, token, amount):
        # Copy the initial merkle root
        rootBefore = self._accountsTree._root

        if not(str(accountID) in self._accounts):
            accountBefore = copyAccountInfo(Account(0, Point(0, 0), 0))
        else:
            accountBefore = copyAccountInfo(self.getAccount(accountID))

        proof = self._accountsTree.createProof(accountID)

        # Create the account if necessary
        if not(str(accountID) in self._accounts):
            self._accounts[str(accountID)] = Account(secretKey, Point(publicKeyX, publicKeyY), walletID)

        account = self.getAccount(accountID)
        balanceUpdate = account.updateBalance(token, amount)
        self._accountsTree.update(accountID, account.hash())

        accountAfter = copyAccountInfo(account)

        rootAfter = self._accountsTree._root

        accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        return Deposit(balanceUpdate, accountUpdate)

    def getAccount(self, accountID):
        # Make sure the leaf exist in our map
        if not(str(accountID) in self._accounts):
            print("Account doesn't exist: " + str(accountID))
        return self._accounts[str(accountID)]

    def getFeeToken(self, tokenID):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._feeTokens):
            self._feeTokens[str(tokenID)] = FeeToken()
        return self._feeTokens[str(tokenID)]

    def withdraw(self, onchain, accountID, tokenID, amount):
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        proof = self._accountsTree.createProof(accountID)

        balance = int(self.getAccount(accountID).getBalance(tokenID))
        amountWithdrawn = int(amount) if (int(amount) < balance) else balance
        print("Withdraw: " + str(amountWithdrawn) + " (requested: " + str(amount) + ")")

        balanceUpdate = self.getAccount(accountID).updateBalance(tokenID, -amountWithdrawn)

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

        account = self.getAccount(accountID)
        withdrawal = Withdrawal(Point(int(account.publicKeyX), int(account.publicKeyY)),
                                accountID, tokenID, amount,
                                amountWithdrawn, balanceUpdate, accountUpdate)
        withdrawal.sign(FQ(int(account.secretKey)))
        return withdrawal

    def cancelOrder(self, accountID, tokenID, orderID):
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        proof = self._accountsTree.createProof(accountID)

        (balanceUpdate, tradeHistoryUpdate) = self.getAccount(accountID).cancelOrder(tokenID, orderID)

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

        account = self.getAccount(accountID)
        cancellation = Cancellation(Point(int(account.publicKeyX), int(account.publicKeyY)),
                                    accountID, tokenID, orderID, account.nonce,
                                    tradeHistoryUpdate, balanceUpdate, accountUpdate)
        cancellation.sign(FQ(int(account.secretKey)))
        return cancellation

    def updateAccountTree(self, accountID):
        self._accountsTree.update(accountID, self.getAccount(accountID).hash())

    def updateFeeTokensTree(self, tokenID):
        self._feeTokensTree.update(tokenID, self.getFeeToken(tokenID).hash())

    def updateBurnBalance(self, tokenID, amount):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._feeTokens):
            self._feeTokens[str(tokenID)] = FeeToken()
        self._feeTokens[str(tokenID)].balance = str(int(self._feeTokens[str(tokenID)].balance) + amount)

    def getRoot(self):
        return mimc_hash([int(self.getAccountsRoot()), int(self.getFeesRoot())], 1)

    def getAccountsRoot(self):
        return self._accountsTree._root

    def getFeesRoot(self):
        return self._feeTokensTree._root

