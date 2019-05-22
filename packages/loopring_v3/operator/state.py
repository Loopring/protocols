import sys
import json
import copy
from collections import namedtuple

from sparse_merkle_tree import SparseMerkleTree
from float import *

from ethsnarks.eddsa import PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.mimc import mimc_hash
from ethsnarks.merkletree import MerkleTree

TREE_DEPTH_TRADING_HISTORY = 14
TREE_DEPTH_ACCOUNTS = 20
TREE_DEPTH_TOKENS = 8

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

def getDefaultAccount():
    return Account(0, Point(0, 0))

class Context(object):
    def __init__(self, operatorAccountID, timestamp, protocolTakerFeeBips, protocolMakerFeeBips):
        self.operatorAccountID = int(operatorAccountID)
        self.timestamp = int(timestamp)
        self.protocolTakerFeeBips = int(protocolTakerFeeBips)
        self.protocolMakerFeeBips = int(protocolMakerFeeBips)

class Signature(object):
    def __init__(self, sig):
        if sig != None:
            self.Rx = str(sig.R.x)
            self.Ry = str(sig.R.y)
            self.s = str(sig.s)
        else:
            self.Rx = "0"
            self.Ry = "0"
            self.s = "0"

class BalanceLeaf(object):
    def __init__(self, balance = 0):
        self.balance = str(balance)
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}
        # print("Empty trading tree: " + str(self._tradingHistoryTree._root))

    def hash(self):
        return mimc_hash([int(self.balance), int(self._tradingHistoryTree._root)], 1)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]
        # Trading history
        tradeHistoryLeafsDict = jBalance["_tradeHistoryLeafs"]
        for key, val in tradeHistoryLeafsDict.items():
            self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["cancelled"], val["orderID"])
        self._tradingHistoryTree._root = jBalance["_tradingHistoryTree"]["_root"]
        self._tradingHistoryTree._db.kv = jBalance["_tradingHistoryTree"]["_db"]["kv"]

    def getTradeHistory(self, orderID):
        address = int(orderID) % (2 ** TREE_DEPTH_TRADING_HISTORY)
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            return TradeHistoryLeaf()
        else:
            return self._tradeHistoryLeafs[str(address)]

    def updateTradeHistory(self, orderID, filled, cancelled, orderIDToStore):
        address = int(orderID) % (2 ** TREE_DEPTH_TRADING_HISTORY)
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            self._tradeHistoryLeafs[str(address)] = TradeHistoryLeaf(0, 0, 0)

        leafBefore = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        rootBefore = self._tradingHistoryTree._root
        #print("leafBefore: " + str(leafBefore))
        self._tradeHistoryLeafs[str(address)].filled = str(filled)
        self._tradeHistoryLeafs[str(address)].cancelled = cancelled
        self._tradeHistoryLeafs[str(address)].orderID = int(orderIDToStore)
        leafAfter = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        #print("leafAfter: " + str(leafAfter))
        proof = self._tradingHistoryTree.createProof(address)
        self._tradingHistoryTree.update(address, leafAfter.hash())
        rootAfter = self._tradingHistoryTree._root

        return TradeHistoryUpdateData(orderID, proof,
                                      rootBefore, rootAfter,
                                      leafBefore, leafAfter)

    def resetTradeHistory(self):
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}


class TradeHistoryLeaf(object):
    def __init__(self, filled = 0, cancelled = 0, orderID = 0):
        self.filled = str(filled)
        self.cancelled = cancelled
        self.orderID = orderID

    def hash(self):
        return mimc_hash([int(self.filled), int(self.cancelled), int(self.orderID)], 1)

    def fromJSON(self, jAccount):
        self.filled = jAccount["filled"]
        self.cancelled = int(jAccount["cancelled"])
        self.orderID = int(jAccount["orderID"])


class Account(object):
    def __init__(self, secretKey, publicKey):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.nonce = 0
        # Balances
        self._balancesTree = SparseMerkleTree(TREE_DEPTH_TOKENS)
        self._balancesTree.newTree(BalanceLeaf().hash())
        self._balancesLeafs = {}
        #print("Empty balances tree: " + str(self._balancesTree._root))

    def hash(self):
        return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.nonce), int(self._balancesTree._root)], 1)

    def fromJSON(self, jAccount):
        self.secretKey = jAccount["secretKey"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.nonce = int(jAccount["nonce"])
        # Balances
        balancesLeafsDict = jAccount["_balancesLeafs"]
        for key, val in balancesLeafsDict.items():
            balanceLeaf = BalanceLeaf()
            balanceLeaf.fromJSON(val)
            self._balancesLeafs[key] = balanceLeaf
        self._balancesTree._root = jAccount["_balancesTree"]["_root"]
        self._balancesTree._db.kv = jAccount["_balancesTree"]["_db"]["kv"]

    def getBalanceLeaf(self, address):
        # Make sure the leaf exist in our map
        if not(str(address) in self._balancesLeafs):
            return BalanceLeaf()
        else:
            return self._balancesLeafs[str(address)]

    def getBalance(self, address):
        return self.getBalanceLeaf(address).balance

    def updateBalance(self, tokenID, amount, shutdown = False):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + amount)
        if int(self._balancesLeafs[str(tokenID)].balance) >= 2 ** 96:
            self._balancesLeafs[str(tokenID)].balance = str((2 ** 96) - 1)
        if shutdown:
            self._balancesLeafs[str(tokenID)].resetTradeHistory()

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter)

    def updateBalanceAndTradeHistory(self, tokenID, orderID, amount, filled, cancelledToStore, orderIDToStore):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update filled amounts
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, filled, cancelledToStore, orderIDToStore)
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
        filled = int(self._balancesLeafs[str(tokenID)].getTradeHistory(orderID).filled)
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, filled, 1, orderID)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return (BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter),
                tradeHistoryUpdate)


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


class Deposit(object):
    def __init__(self, amount, balanceUpdate, accountUpdate):
        self.amount = str(amount)
        self.balanceUpdate = balanceUpdate
        self.accountUpdate = accountUpdate


class WithdrawProof(object):
    def __init__(self,
                 realmID, accountID, tokenID,
                 account, balance,
                 root,
                 accountProof, balanceProof):
        self.accountID = int(accountID)
        self.tokenID = int(tokenID)
        self.account = account
        self.balance = balance
        self.root = str(root)
        self.accountProof = [str(_) for _ in accountProof]
        self.balanceProof = [str(_) for _ in balanceProof]

class Order(object):
    def __init__(self,
                 publicKey, walletPublicKey,
                 dualAuthPublicKey, dualAuthSecretKey,
                 realmID, orderID, accountID, walletAccountID,
                 tokenS, tokenB,
                 amountS, amountB,
                 allOrNone, validSince, validUntil,
                 maxFeeBips, minWalletSplitPercentage,
                 feeBips, walletSplitPercentage):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)
        self.dualAuthPublicKeyX = str(dualAuthPublicKey.x)
        self.dualAuthPublicKeyY = str(dualAuthPublicKey.y)
        self.dualAuthSecretKey = str(dualAuthSecretKey)

        self.realmID = int(realmID)
        self.orderID = int(orderID)
        self.accountID = int(accountID)
        self.walletAccountID = int(walletAccountID)

        self.amountS = str(amountS)
        self.amountB = str(amountB)

        self.tokenS = tokenS
        self.tokenB = tokenB

        self.allOrNone = bool(allOrNone)
        self.validSince = validSince
        self.validUntil = validUntil
        self.maxFeeBips = maxFeeBips
        self.minWalletSplitPercentage = minWalletSplitPercentage

        self.feeBips = feeBips
        self.walletSplitPercentage = walletSplitPercentage


    def message(self):
        msg_parts = [
                        FQ(int(self.realmID), 1<<32), FQ(int(self.orderID), 1<<20),
                        FQ(int(self.accountID), 1<<20), FQ(int(self.walletAccountID), 1<<20),
                        FQ(int(self.dualAuthPublicKeyX), 1<<254), FQ(int(self.dualAuthPublicKeyY), 1<<254),
                        FQ(int(self.tokenS), 1<<8), FQ(int(self.tokenB), 1<<8),
                        FQ(int(self.amountS), 1<<96), FQ(int(self.amountB), 1<<96),
                        FQ(int(self.allOrNone), 1<<1), FQ(int(self.validSince), 1<<32), FQ(int(self.validUntil), 1<<32),
                        FQ(int(self.maxFeeBips), 1<<8), FQ(int(self.minWalletSplitPercentage), 1 << 7),
                        FQ(int(0), 1<<2)
                    ]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        signedMessage = PureEdDSA.sign(msg, k)
        self.hash = PureEdDSA().hash_public(signedMessage.sig.R, signedMessage.A, signedMessage.msg)
        self.signature = Signature(signedMessage.sig)

    def checkValid(self, context, fillAmountS, fillAmountB):
        valid = True

        valid = valid and (self.validSince <= context.timestamp)
        valid = valid and (context.timestamp <= self.validUntil)

        valid = valid and not self.hasRoundingError(fillAmountS, int(self.amountB), int(self.amountS))
        valid = valid and not (self.allOrNone and fillAmountS != int(self.amountS))
        valid = valid and fillAmountS != 0
        valid = valid and fillAmountB != 0

        self.valid = valid

    def hasRoundingError(self, value, numerator, denominator):
        multiplied = value * numerator
        remainder = multiplied % denominator
        # Return true if the rounding error is larger than 1%
        return multiplied < remainder * 100


class Ring(object):
    def __init__(self, orderA, orderB, minerAccountID, tokenID, fee, nonce):
        self.orderA = orderA
        self.orderB = orderB
        self.minerAccountID = int(minerAccountID)
        self.tokenID = int(tokenID)
        self.fee = str(fee)
        self.nonce = int(nonce)

    def message(self):
        msg_parts = [
                        FQ(int(self.orderA.hash), 1<<254), FQ(int(self.orderB.hash), 1<<254),
                        FQ(int(self.minerAccountID), 1<<20), FQ(int(self.tokenID), 1<<8), FQ(int(self.fee), 1<<96),
                        FQ(int(self.orderA.feeBips), 1<<8), FQ(int(self.orderB.feeBips), 1<<8),
                        FQ(int(self.orderA.walletSplitPercentage), 1<<7), FQ(int(self.orderB.walletSplitPercentage), 1<<7),
                        FQ(int(self.nonce), 1<<32),
                        FQ(int(0), 1<<1)
                    ]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, miner_k, walletA_k, walletB_k):
        msg = self.message()
        # miner
        signedMessage = PureEdDSA.sign(msg, miner_k)
        self.minerSignature = Signature(signedMessage.sig)
        # walletA
        signedMessage = PureEdDSA.sign(msg, walletA_k)
        self.dualAuthASignature = Signature(signedMessage.sig)
        # walletB
        signedMessage = PureEdDSA.sign(msg, walletB_k)
        self.dualAuthBSignature = Signature(signedMessage.sig)

class RingSettlement(object):
    def __init__(self,
                 ring,
                 accountsMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                 balanceUpdateA_W, accountUpdateA_W,
                 balanceUpdateB_W, accountUpdateB_W,
                 balanceUpdateA_M, balanceUpdateB_M, balanceUpdateO_M, accountUpdate_M,
                 balanceUpdateA_P, balanceUpdateB_P,
                 balanceUpdateF_O,
                 walletFee_A, matchingFee_A,
                 walletFee_B, matchingFee_B):
        self.ring = ring

        self.accountsMerkleRoot = str(accountsMerkleRoot)

        self.tradeHistoryUpdate_A = tradeHistoryUpdate_A
        self.tradeHistoryUpdate_B = tradeHistoryUpdate_B

        self.balanceUpdateS_A = balanceUpdateS_A
        self.balanceUpdateB_A = balanceUpdateB_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateS_B = balanceUpdateS_B
        self.balanceUpdateB_B = balanceUpdateB_B
        self.accountUpdate_B = accountUpdate_B

        self.balanceUpdateA_W = balanceUpdateA_W
        self.accountUpdateA_W = accountUpdateA_W

        self.balanceUpdateB_W = balanceUpdateB_W
        self.accountUpdateB_W = accountUpdateB_W

        self.balanceUpdateA_M = balanceUpdateA_M
        self.balanceUpdateB_M = balanceUpdateB_M
        self.balanceUpdateO_M = balanceUpdateO_M
        self.accountUpdate_M = accountUpdate_M

        self.balanceUpdateA_P = balanceUpdateA_P
        self.balanceUpdateB_P = balanceUpdateB_P

        self.balanceUpdateF_O = balanceUpdateF_O

        self.walletFee_A = walletFee_A
        self.matchingFee_A = matchingFee_A

        self.walletFee_B = walletFee_B
        self.matchingFee_B = matchingFee_B


class OnchainWithdrawal(object):
    def __init__(self,
                 amountRequested, balanceUpdate, accountUpdate,
                 accountID, tokenID, fAmountWithdrawn):
        self.amountRequested = str(amountRequested)
        self.balanceUpdate = balanceUpdate
        self.accountUpdate = accountUpdate
        self.accountID = accountID
        self.tokenID = tokenID
        self.fAmountWithdrawn = int(fAmountWithdrawn)

class OffchainWithdrawal(object):
    def __init__(self,
                 realmID,
                 accountID, tokenID, amountRequested, fAmountWithdrawn,
                 walletAccountID, feeTokenID, fee, walletSplitPercentage,
                 balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O,
                 nonce):
        self.realmID = realmID

        self.accountID = accountID
        self.tokenID = tokenID
        self.amountRequested = str(amountRequested)
        self.fAmountWithdrawn = int(fAmountWithdrawn)

        self.walletAccountID = walletAccountID
        self.feeTokenID = feeTokenID
        self.fee = str(fee)
        self.walletSplitPercentage = walletSplitPercentage

        self.balanceUpdateF_A = balanceUpdateF_A
        self.balanceUpdateW_A = balanceUpdateW_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateF_W = balanceUpdateF_W
        self.accountUpdate_W = accountUpdate_W

        self.balanceUpdateF_O = balanceUpdateF_O

        self.nonce = nonce

    def message(self):
        msg_parts = [FQ(int(self.realmID), 1<<32),
                     FQ(int(self.accountID), 1<<20), FQ(int(self.tokenID), 1<<8), FQ(int(self.amountRequested), 1<<96),
                     FQ(int(self.walletAccountID), 1<<20), FQ(int(self.feeTokenID), 1<<8),
                     FQ(int(self.fee), 1<<96), FQ(int(self.walletSplitPercentage), 1<<7),
                     FQ(int(self.nonce), 1<<32), FQ(int(0), 1<<1)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        # owner
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)


class Cancellation(object):
    def __init__(self,
                 realmID,
                 accountID, orderTokenID, orderID, walletAccountID,
                 feeTokenID, fee, walletSplitPercentage,
                 nonce,
                 tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O):
        self.realmID = realmID

        self.accountID = accountID
        self.orderTokenID = orderTokenID
        self.orderID = orderID
        self.walletAccountID = walletAccountID
        self.feeTokenID = feeTokenID
        self.fee = str(fee)
        self.walletSplitPercentage = walletSplitPercentage
        self.nonce = nonce

        self.tradeHistoryUpdate_A = tradeHistoryUpdate_A
        self.balanceUpdateT_A = balanceUpdateT_A
        self.balanceUpdateF_A = balanceUpdateF_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateF_W = balanceUpdateF_W
        self.accountUpdate_W = accountUpdate_W

        self.balanceUpdateF_O = balanceUpdateF_O


    def message(self):
        msg_parts = [FQ(int(self.realmID), 1<<32), FQ(int(self.accountID), 1<<20),
                     FQ(int(self.orderTokenID), 1<<8), FQ(int(self.orderID), 1<<20), FQ(int(self.walletAccountID), 1<<20),
                     FQ(int(self.feeTokenID), 1<<8), FQ(int(self.fee), 1<<96), FQ(int(self.walletSplitPercentage), 1<<7),
                     FQ(int(self.nonce), 1<<32), FQ(int(0), 1<<2)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k):
        msg = self.message()
        # owner
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)


class State(object):
    def __init__(self, realmID):
        self.realmID = int(realmID)
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(getDefaultAccount().hash())
        self._accounts = {}
        self._accounts[str(0)] = getDefaultAccount()
        # print("Empty accounts tree: " + str(hex(self._accountsTree._root)))

    def load(self, filename):
        with open(filename) as f:
            data = json.load(f)
            self.realmID = int(data["realmID"])
            # Accounts
            accountLeafsDict = data["accounts_values"]
            for key, val in accountLeafsDict.items():
                account = getDefaultAccount()
                account.fromJSON(val)
                self._accounts[key] = account
            self._accountsTree._root = data["accounts_root"]
            self._accountsTree._db.kv = data["accounts_tree"]

    def save(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "realmID": self.realmID,
                    "accounts_values": self._accounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def calculateFees(self, amountB, feeBips, protocolFeeBips, walletSplitPercentage):
        protocolFee = (amountB * protocolFeeBips) // 100000
        fee = (amountB * feeBips) // 10000
        walletFee = (fee * walletSplitPercentage) // 100
        matchingFee = fee - walletFee
        return (fee, protocolFee, walletFee, matchingFee)

    def getMaxFillAmounts(self, order):
        account = self.getAccount(order.accountID)
        tradeHistory = account.getBalanceLeaf(order.tokenS).getTradeHistory(int(order.orderID))
        order.tradeHistoryFilled = str(tradeHistory.filled)
        order.tradeHistoryCancelled = int(tradeHistory.cancelled)
        order.tradeHistoryOrderID = int(tradeHistory.orderID)
        order.nonce = int(account.nonce)

        # Trade history trimming
        bNew = tradeHistory.orderID < order.orderID
        bTrim = not (tradeHistory.orderID <= order.orderID)
        filled = 0 if bNew else int(tradeHistory.filled)
        cancelledToStore = 0 if bNew else int(tradeHistory.cancelled)
        cancelled = 1 if bTrim else cancelledToStore
        orderIDToStore = int(order.orderID) if bNew else tradeHistory.orderID

        """
        print("bNew: " + str(bNew))
        print("bTrim: " + str(bTrim))
        print("filled: " + str(filled))
        print("cancelledToStore: " + str(cancelledToStore))
        print("cancelled: " + str(cancelled))
        print("orderIDToStore: " + str(orderIDToStore))
        """

        # Scale the order
        balanceS = int(account.getBalance(order.tokenS))
        remainingS = int(order.amountS) - filled
        if cancelled == 1:
            remainingS = 0
        fillAmountS = balanceS if (balanceS < remainingS) else remainingS
        fillAmountB = (fillAmountS * int(order.amountB)) // int(order.amountS)
        return (fillAmountS, fillAmountB, filled, cancelledToStore, orderIDToStore)

    def settleRing(self, context, ring):
        #print("State update ring: ")

        (fillAmountS_A, fillAmountB_A, filled_A, cancelledToStore_A, orderIDToStore_A) = self.getMaxFillAmounts(ring.orderA)
        (fillAmountS_B, fillAmountB_B, filled_B, cancelledToStore_B, orderIDToStore_B) = self.getMaxFillAmounts(ring.orderB)

        '''
        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("-------------")
        '''

        if fillAmountB_A < fillAmountS_B:
            fillAmountS_B = fillAmountB_A
            fillAmountB_B = (fillAmountS_B * int(ring.orderB.amountB)) // int(ring.orderB.amountS)
        else:
            fillAmountB_A = fillAmountS_B
            fillAmountS_A = (fillAmountB_A * int(ring.orderA.amountS)) // int(ring.orderA.amountB)
        bSurplus = fillAmountB_B < fillAmountS_A
        tradeSurplus = fillAmountS_A - fillAmountB_B if bSurplus else 0
        tradeDeficit = fillAmountB_B - fillAmountS_A if not bSurplus else 0
        spread = tradeSurplus + tradeDeficit

        # matchablee
        ring.orderA.checkValid(context, fillAmountS_A, fillAmountB_A)
        ring.orderB.checkValid(context, fillAmountS_B, fillAmountB_B)
        ring.valid = ring.orderA.valid and ring.orderB.valid

        #print("ring.orderA.valid " + str(ring.orderA.valid))
        #print("ring.orderB.valid " + str(ring.orderB.valid))

        if ring.valid == False:
            #print("ring.valid false: ")
            fillAmountS_A = 0
            fillAmountB_A = 0
            fillAmountS_B = 0
            fillAmountB_B = 0
            tradeSurplus = 0
            tradeDeficit = 0

        # Saved in ring for tests
        ring.fFillS_A = toFloat(fillAmountS_A, Float24Encoding)
        ring.fFillS_B = toFloat(fillAmountS_B, Float24Encoding)
        ring.fSpread = toFloat(spread, Float24Encoding)
        ring.bSurplus = bSurplus

        fillS_A = roundToFloatValue(fillAmountS_A, Float24Encoding)
        fillS_B = roundToFloatValue(fillAmountS_B, Float24Encoding)
        spread = roundToFloatValue(spread, Float24Encoding)
        tradeSurplus = spread if tradeSurplus > 0 else 0
        tradeDeficit = spread if tradeDeficit > 0 else 0

        print("Before: ")
        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("...")
        print("fillS_A: " + str(fillS_A))
        print("fillS_B: " + str(fillS_B))
        print("...")

        fillB_A = int(fillS_B)
        fillB_B = int(fillS_A) - int(tradeSurplus) + int(tradeDeficit)

        protocolFeeTradeSurplus = (tradeSurplus * context.protocolTakerFeeBips) // 100000

        ringFee = roundToFloatValue(ring.fee, Float12Encoding)


        print("fillS_A: " + str(fillS_A))
        print("fillB_A: " + str(fillB_A))
        print("fillS_B: " + str(fillS_B))
        print("fillB_B: " + str(fillB_B))

        print("tradeSurplus: " + str(tradeSurplus))
        print("tradeDeficit: " + str(tradeDeficit))
        print("spread: " + str(spread))

        '''
        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("margin: " + str(margin))
        '''

        '''
        print("ring.fillS_A: " + str(ring.fillS_A))
        print("ring.fillS_B: " + str(ring.fillS_B))
        print("ring.margin: " + str(ring.margin))
        print("fillB_B: " + str(fillB_B))
        '''

        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        (fee_A, protocolFee_A, walletFee_A, matchingFee_A) = self.calculateFees(
            fillB_A,
            ring.orderA.feeBips,
            context.protocolTakerFeeBips,
            ring.orderA.walletSplitPercentage
        )

        (fee_B, protocolFee_B, walletFee_B, matchingFee_B) = self.calculateFees(
            fillB_B,
            ring.orderB.feeBips,
            context.protocolMakerFeeBips,
            ring.orderB.walletSplitPercentage
        )

        print("fee_A: " + str(fee_A))
        print("protocolFee_A: " + str(protocolFee_A))
        print("walletFee_A: " + str(walletFee_A))
        print("matchingFee_A: " + str(matchingFee_A))

        print("fee_B: " + str(fee_B))
        print("protocolFee_B: " + str(protocolFee_B))
        print("walletFee_B: " + str(walletFee_B))
        print("matchingFee_B: " + str(matchingFee_B))

        # Update balances A
        accountA = self.getAccount(ring.orderA.accountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        proof = self._accountsTree.createProof(ring.orderA.accountID)

        (balanceUpdateS_A, tradeHistoryUpdate_A) = accountA.updateBalanceAndTradeHistory(
            ring.orderA.tokenS, ring.orderA.orderID, -fillS_A,
            filled_A + fillS_A, cancelledToStore_A, orderIDToStore_A
        )
        balanceUpdateB_A = accountA.updateBalance(ring.orderA.tokenB, fillB_A - fee_A)

        self.updateAccountTree(ring.orderA.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(ring.orderA.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update balances B
        accountB = self.getAccount(ring.orderB.accountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        proof = self._accountsTree.createProof(ring.orderB.accountID)

        (balanceUpdateS_B, tradeHistoryUpdate_B) = accountB.updateBalanceAndTradeHistory(
            ring.orderB.tokenS, ring.orderB.orderID, -fillS_B,
            filled_B + int(fillS_B), cancelledToStore_B, orderIDToStore_B
        )
        balanceUpdateB_B = accountB.updateBalance(ring.orderB.tokenB, fillB_B - fee_B)

        self.updateAccountTree(ring.orderB.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(ring.orderB.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet A
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.walletAccountID))
        proof = self._accountsTree.createProof(ring.orderA.walletAccountID)

        balanceUpdateA_W = self.getAccount(ring.orderA.walletAccountID).updateBalance(ring.orderA.tokenB, walletFee_A)

        self.updateAccountTree(ring.orderA.walletAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderA.walletAccountID))
        rootAfter = self._accountsTree._root
        accountUpdateA_W = AccountUpdateData(ring.orderA.walletAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet B
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderB.walletAccountID))
        proof = self._accountsTree.createProof(ring.orderB.walletAccountID)

        balanceUpdateB_W = self.getAccount(ring.orderB.walletAccountID).updateBalance(ring.orderB.tokenB, walletFee_B)

        self.updateAccountTree(ring.orderB.walletAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.walletAccountID))
        rootAfter = self._accountsTree._root
        accountUpdateB_W = AccountUpdateData(ring.orderB.walletAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update ringmatcher
        accountM = self.getAccount(ring.minerAccountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.minerAccountID))
        proof = self._accountsTree.createProof(ring.minerAccountID)

        balanceUpdateA_M = accountM.updateBalance(ring.orderA.tokenB, matchingFee_A - protocolFee_A)
        balanceUpdateB_M = accountM.updateBalance(ring.orderB.tokenB, matchingFee_B - protocolFee_B + tradeSurplus - tradeDeficit - protocolFeeTradeSurplus)
        balanceUpdateO_M = accountM.updateBalance(ring.tokenID, -ringFee)
        accountM.nonce += 1

        self.updateAccountTree(ring.minerAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.minerAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_M = AccountUpdateData(ring.minerAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Protocol fee payment
        balanceUpdateA_P = self.getAccount(0).updateBalance(ring.orderA.tokenB, protocolFee_A)
        balanceUpdateB_P = self.getAccount(0).updateBalance(ring.orderB.tokenB, protocolFee_B + protocolFeeTradeSurplus)
        ###

        # Operator payment
        balanceUpdateF_O = self.getAccount(context.operatorAccountID).updateBalance(ring.tokenID, ringFee)
        ###

        return RingSettlement(ring,
                              accountsMerkleRoot,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                              balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                              balanceUpdateA_W, accountUpdateA_W,
                              balanceUpdateB_W, accountUpdateB_W,
                              balanceUpdateA_M, balanceUpdateB_M, balanceUpdateO_M, accountUpdate_M,
                              balanceUpdateA_P, balanceUpdateB_P,
                              balanceUpdateF_O,
                              walletFee_A, matchingFee_A,
                              walletFee_B, matchingFee_B)


    def deposit(self, accountID, secretKey, publicKeyX, publicKeyY, token, amount):
        # Copy the initial merkle root
        rootBefore = self._accountsTree._root

        if not(str(accountID) in self._accounts):
            accountBefore = copyAccountInfo(getDefaultAccount())
        else:
            accountBefore = copyAccountInfo(self.getAccount(accountID))

        proof = self._accountsTree.createProof(accountID)

        # Create the account if necessary
        if not(str(accountID) in self._accounts):
            self._accounts[str(accountID)] = Account(secretKey, Point(publicKeyX, publicKeyY))

        account = self.getAccount(accountID)
        balanceUpdate = account.updateBalance(token, amount)

        # Update keys
        account.secretKey = str(secretKey)
        account.publicKeyX = str(publicKeyX)
        account.publicKeyY = str(publicKeyY)

        self._accountsTree.update(accountID, account.hash())

        accountAfter = copyAccountInfo(account)

        rootAfter = self._accountsTree._root

        accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        return Deposit(amount, balanceUpdate, accountUpdate)

    def getAccount(self, accountID):
        # Make sure the leaf exist in our map
        if not(str(accountID) in self._accounts):
            print("Account doesn't exist: " + str(accountID))
        return self._accounts[str(accountID)]

    def onchainWithdraw(self, realmID, accountID, tokenID, amountRequested, shutdown):
        # When a withdrawal is done before the deposit (account creation) we shouldn't
        # do anything. Just leave everything as it is.
        if str(accountID) in self._accounts:
            # Calculate amount withdrawn
            balance = int(self.getAccount(accountID).getBalance(tokenID))
            uAmountMin = int(amountRequested) if (int(amountRequested) < balance) else balance

            # Withdraw the complete balance in shutdown
            uAmount = balance if shutdown else uAmountMin

            fAmount = toFloat(uAmount, Float28Encoding)
            amount = fromFloat(fAmount, Float28Encoding)

            # Make sure no 'dust' remains after a withdrawal in shutdown
            amountToSubtract = uAmount if shutdown else amount

            # Update account
            rootBefore = self._accountsTree._root
            accountBefore = copyAccountInfo(self.getAccount(accountID))
            proof = self._accountsTree.createProof(accountID)

            balanceUpdate = self.getAccount(accountID).updateBalance(tokenID, -amountToSubtract, shutdown)
            if shutdown:
                self.getAccount(accountID).publicKeyX = str(0)
                self.getAccount(accountID).publicKeyY = str(0)
                self.getAccount(accountID).nonce = 0

            self.updateAccountTree(accountID)
            accountAfter = copyAccountInfo(self.getAccount(accountID))
            rootAfter = self._accountsTree._root
            accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
            ###
        else:
            # Dummy update
            fAmount = 0

            rootBefore = self._accountsTree._root
            accountBefore = copyAccountInfo(getDefaultAccount())
            proof = self._accountsTree.createProof(accountID)

            balanceUpdate = getDefaultAccount().updateBalance(tokenID, 0, shutdown)

            accountAfter = copyAccountInfo(getDefaultAccount())
            rootAfter = self._accountsTree._root
            accountUpdate = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
            ###

        withdrawal = OnchainWithdrawal(amountRequested, balanceUpdate, accountUpdate,
                                       accountID, tokenID, fAmount)
        return withdrawal

    def offchainWithdraw(self,
                         realmID, accountID, tokenID, amountRequested,
                         operatorAccountID, walletAccountID, feeTokenID, fee, walletSplitPercentage):
        feeValue = roundToFloatValue(fee, Float16Encoding)

        feeToWallet = feeValue * walletSplitPercentage // 100
        feeToOperator = feeValue - feeToWallet

        # Update account
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountID)

        balanceUpdateF_A = self.getAccount(accountID).updateBalance(feeTokenID, -feeValue)

        balance = int(self.getAccount(accountID).getBalance(tokenID))
        uAmountWithdrawn = int(amountRequested) if (int(amountRequested) < balance) else balance

        fAmountWithdrawn = toFloat(uAmountWithdrawn, Float28Encoding)
        amountWithdrawn = fromFloat(fAmountWithdrawn, Float28Encoding)

        balanceUpdateW_A = self.getAccount(accountID).updateBalance(tokenID, -amountWithdrawn)
        self.getAccount(accountID).nonce += 1

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(walletAccountID))
        proof = self._accountsTree.createProof(walletAccountID)

        balanceUpdateF_W = self.getAccount(walletAccountID).updateBalance(feeTokenID, feeToWallet)

        self.updateAccountTree(walletAccountID)
        accountAfter = copyAccountInfo(self.getAccount(walletAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_W = AccountUpdateData(walletAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Operator payment
        balanceUpdateF_O = self.getAccount(operatorAccountID).updateBalance(feeTokenID, feeToOperator)

        account = self.getAccount(accountID)
        withdrawal = OffchainWithdrawal(realmID,
                                        accountID, tokenID, amountRequested, fAmountWithdrawn,
                                        walletAccountID, feeTokenID, fee, walletSplitPercentage,
                                        balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                                        balanceUpdateF_W, accountUpdate_W,
                                        balanceUpdateF_O,
                                        nonce)
        withdrawal.sign(FQ(int(account.secretKey)))
        return withdrawal

    def cancelOrder(self,
                    realmID, accountID, orderTokenID, orderID, walletAccountID,
                    operatorAccountID, feeTokenID, fee, walletSplitPercentage):

        feeValue = roundToFloatValue(fee, Float16Encoding)

        feeToWallet = feeValue * walletSplitPercentage // 100
        feeToOperator = feeValue - feeToWallet

        # Update account
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountID)

        (balanceUpdateT_A, tradeHistoryUpdate_A) = self.getAccount(accountID).cancelOrder(orderTokenID, orderID)
        balanceUpdateF_A = self.getAccount(accountID).updateBalance(feeTokenID, -feeValue)
        self.getAccount(accountID).nonce += 1

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(walletAccountID))
        proof = self._accountsTree.createProof(walletAccountID)

        balanceUpdateF_W = self.getAccount(walletAccountID).updateBalance(feeTokenID, feeToWallet)

        self.updateAccountTree(walletAccountID)
        accountAfter = copyAccountInfo(self.getAccount(walletAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_W = AccountUpdateData(walletAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Operator payment
        balanceUpdateF_O = self.getAccount(operatorAccountID).updateBalance(feeTokenID, feeToOperator)

        account = self.getAccount(accountID)
        cancellation = Cancellation(realmID,
                                    accountID, orderTokenID, orderID, walletAccountID,
                                    feeTokenID, fee, walletSplitPercentage,
                                    nonce,
                                    tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                                    balanceUpdateF_W, accountUpdate_W,
                                    balanceUpdateF_O)
        cancellation.sign(FQ(int(account.secretKey)))
        return cancellation

    def createWithdrawProof(self, realmID, accountID, tokenID):
        account = copyAccountInfo(self.getAccount(accountID))
        balance = copyBalanceInfo(self.getAccount(accountID)._balancesLeafs[str(tokenID)])
        accountProof = self._accountsTree.createProof(accountID)
        balanceProof = self.getAccount(accountID)._balancesTree.createProof(tokenID)

        return WithdrawProof(realmID, accountID, tokenID,
                             account, balance,
                             self.getRoot(),
                             accountProof, balanceProof)

    def updateAccountTree(self, accountID):
        self._accountsTree.update(accountID, self.getAccount(accountID).hash())

    def getRoot(self):
        return self._accountsTree._root

