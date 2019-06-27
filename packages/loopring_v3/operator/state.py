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

class Fill(object):
    def __init__(self, amountS, amountB):
        self.S = int(amountS)
        self.B = int(amountB)

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
                 exchangeID, accountID, tokenID,
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
                 publicKey,
                 dualAuthPublicKey, dualAuthSecretKey,
                 exchangeID, orderID, accountID,
                 tokenS, tokenB,
                 amountS, amountB,
                 allOrNone, validSince, validUntil, buy,
                 maxFeeBips, feeBips, rebateBips):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.dualAuthPublicKeyX = str(dualAuthPublicKey.x)
        self.dualAuthPublicKeyY = str(dualAuthPublicKey.y)
        self.dualAuthSecretKey = str(dualAuthSecretKey)

        self.exchangeID = int(exchangeID)
        self.orderID = int(orderID)
        self.accountID = int(accountID)

        self.amountS = str(amountS)
        self.amountB = str(amountB)

        self.tokenS = tokenS
        self.tokenB = tokenB

        self.allOrNone = bool(allOrNone)
        self.validSince = validSince
        self.validUntil = validUntil
        self.buy = bool(buy)
        self.maxFeeBips = maxFeeBips

        self.feeBips = feeBips
        self.rebateBips = rebateBips

    def checkValid(self, context, order, fillAmountS, fillAmountB):
        valid = True

        valid = valid and (self.validSince <= context.timestamp)
        valid = valid and (context.timestamp <= self.validUntil)

        valid = valid and not self.hasRoundingError(fillAmountS, int(order.amountB), int(order.amountS))
        valid = valid and not (not self.buy and self.allOrNone and fillAmountS < int(order.amountS))
        valid = valid and not (self.buy and self.allOrNone and fillAmountB < int(order.amountB))
        valid = valid and fillAmountS != 0
        valid = valid and fillAmountB != 0

        self.valid = valid

    def hasRoundingError(self, value, numerator, denominator):
        multiplied = value * numerator
        remainder = multiplied % denominator
        # Return true if the rounding error is larger than 1%
        return multiplied < remainder * 100


class Ring(object):
    def __init__(self, orderA, orderB, ringMatcherAccountID, tokenID, fee, nonce):
        self.orderA = orderA
        self.orderB = orderB
        self.ringMatcherAccountID = int(ringMatcherAccountID)
        self.tokenID = int(tokenID)
        self.fee = str(fee)
        self.nonce = int(nonce)

class RingSettlement(object):
    def __init__(self,
                 ring,
                 accountsMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                 balanceUpdateA_M, balanceUpdateB_M, balanceUpdateO_M, accountUpdate_M,
                 balanceUpdateA_P, balanceUpdateB_P,
                 balanceUpdateF_O,
                 feeToOperator):
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

        self.balanceUpdateA_M = balanceUpdateA_M
        self.balanceUpdateB_M = balanceUpdateB_M
        self.balanceUpdateO_M = balanceUpdateO_M
        self.accountUpdate_M = accountUpdate_M

        self.balanceUpdateA_P = balanceUpdateA_P
        self.balanceUpdateB_P = balanceUpdateB_P

        self.balanceUpdateF_O = balanceUpdateF_O

        self.feeToOperator = feeToOperator


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
                 exchangeID,
                 accountID, tokenID, amountRequested, fAmountWithdrawn,
                 walletAccountID, feeTokenID, fee, walletSplitPercentage,
                 balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O,
                 feeToOperator, nonce):
        self.exchangeID = exchangeID

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

        self.feeToOperator = feeToOperator
        self.nonce = nonce

class Cancellation(object):
    def __init__(self,
                 exchangeID,
                 accountID, orderTokenID, orderID, walletAccountID,
                 feeTokenID, fee, walletSplitPercentage,
                 nonce,
                 tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O,
                 feeToOperator):
        self.exchangeID = exchangeID

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

        self.feeToOperator = feeToOperator


class State(object):
    def __init__(self, exchangeID):
        self.exchangeID = int(exchangeID)
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(getDefaultAccount().hash())
        self._accounts = {}
        self._accounts[str(0)] = getDefaultAccount()
        # print("Empty accounts tree: " + str(hex(self._accountsTree._root)))

    def load(self, filename):
        with open(filename) as f:
            data = json.load(f)
            self.exchangeID = int(data["exchangeID"])
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
                    "exchangeID": self.exchangeID,
                    "accounts_values": self._accounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def calculateFees(self, amountB, feeBips, protocolFeeBips, rebateBips):
        protocolFee = (amountB * protocolFeeBips) // 100000
        fee = (amountB * feeBips) // 10000
        rebate = (amountB * rebateBips) // 10000
        return (fee, protocolFee, rebate)

    def getMaxFillAmounts(self, order):
        account = self.getAccount(order.accountID)
        tradeHistory = account.getBalanceLeaf(order.tokenS).getTradeHistory(int(order.orderID))

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

        limit = int(order.amountB) if order.buy else int(order.amountS)
        filledLimited = limit if limit < filled else filled
        remainingBeforeCancelled = limit - filledLimited
        remaining = 0 if cancelled else remainingBeforeCancelled
        remainingS_buy = remaining * int(order.amountS) // int(order.amountB)
        remainingS = remainingS_buy if order.buy else remaining
        fillAmountS = balanceS if balanceS < remainingS else remainingS
        fillAmountB = fillAmountS * int(order.amountB) // int(order.amountS)
        return (Fill(fillAmountS, fillAmountB), filled, cancelledToStore, orderIDToStore)

    def match(self, takerOrder, takerFill, makerOrder, makerFill):
        if takerFill.B < makerFill.S:
            makerFill.S = takerFill.B
            makerFill.B = takerFill.B * int(makerOrder.amountB) // int(makerOrder.amountS)
        else:
            takerFill.S = makerFill.S * int(takerOrder.amountS) // int(takerOrder.amountB)
            takerFill.B = makerFill.S

        spread = takerFill.S - makerFill.B
        matchable = makerFill.B <= takerFill.S

        return (spread, matchable)

    def settleRing(self, context, ring):
        #print("State update ring: ")

        (fillA, filled_A, cancelledToStore_A, orderIDToStore_A) = self.getMaxFillAmounts(ring.orderA)
        (fillB, filled_B, cancelledToStore_B, orderIDToStore_B) = self.getMaxFillAmounts(ring.orderB)

        '''
        print("fillA.S: " + str(fillA.S))
        print("fillA.B: " + str(fillA.B))
        print("fillB.S: " + str(fillB.S))
        print("fillB.B: " + str(fillB.B))
        print("-------------")
        '''

        if ring.orderA.buy:
            (spread, matchable) = self.match(ring.orderA, fillA, ring.orderB, fillB)
            fillA.S = fillB.B
        else:
            (spread, matchable) = self.match(ring.orderB, fillB, ring.orderA, fillA)
            fillA.B = fillB.S

        # Check valid
        ring.orderA.checkValid(context, ring.orderA, fillA.S, fillA.B)
        ring.orderB.checkValid(context, ring.orderB, fillB.S, fillB.B)
        ring.valid = matchable and ring.orderA.valid and ring.orderB.valid
        #print("ring.orderA.valid " + str(ring.orderA.valid))
        #print("ring.orderB.valid " + str(ring.orderB.valid))
        if ring.valid == False:
            #print("ring.valid false: ")
            fillA.S = 0
            fillA.B = 0
            fillB.S = 0
            fillB.B = 0

        # Saved in ring for tests
        ring.fFillS_A = toFloat(fillA.S, Float24Encoding)
        ring.fFillS_B = toFloat(fillB.S, Float24Encoding)

        fillA.S = roundToFloatValue(fillA.S, Float24Encoding)
        fillB.S = roundToFloatValue(fillB.S, Float24Encoding)
        fillA.B = fillB.S
        fillB.B = fillA.S

        feeToOperator = roundToFloatValue(ring.fee, Float12Encoding)

        '''
        print("fillA.S: " + str(fillA.S))
        print("fillA.B: " + str(fillA.B))
        print("fillB.S: " + str(fillB.S))
        print("fillB.B: " + str(fillB.B))
        print("spread: " + str(spread))
        '''

        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        (fee_A, protocolFee_A, rebate_A) = self.calculateFees(
            fillA.B,
            ring.orderA.feeBips,
            context.protocolTakerFeeBips,
            ring.orderA.rebateBips
        )

        (fee_B, protocolFee_B, rebate_B) = self.calculateFees(
            fillB.B,
            ring.orderB.feeBips,
            context.protocolMakerFeeBips,
            ring.orderB.rebateBips
        )

        '''
        print("fee_A: " + str(fee_A))
        print("protocolFee_A: " + str(protocolFee_A))
        print("rebate_A: " + str(rebate_A))

        print("fee_B: " + str(fee_B))
        print("protocolFee_B: " + str(protocolFee_B))
        print("rebate_B: " + str(rebate_B))
        '''

        # Update balances A
        accountA = self.getAccount(ring.orderA.accountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        proof = self._accountsTree.createProof(ring.orderA.accountID)

        (balanceUpdateS_A, tradeHistoryUpdate_A) = accountA.updateBalanceAndTradeHistory(
            ring.orderA.tokenS, ring.orderA.orderID, -fillA.S,
            filled_A + (fillA.B if ring.orderA.buy else fillA.S), cancelledToStore_A, orderIDToStore_A
        )
        balanceUpdateB_A = accountA.updateBalance(ring.orderA.tokenB, fillA.B - fee_A + rebate_A)

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
            ring.orderB.tokenS, ring.orderB.orderID, -fillB.S,
            filled_B + (fillB.B if ring.orderB.buy else fillB.S), cancelledToStore_B, orderIDToStore_B
        )
        balanceUpdateB_B = accountB.updateBalance(ring.orderB.tokenB, fillB.B - fee_B + rebate_B)

        self.updateAccountTree(ring.orderB.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(ring.orderB.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update ringmatcher
        accountM = self.getAccount(ring.ringMatcherAccountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.ringMatcherAccountID))
        proof = self._accountsTree.createProof(ring.ringMatcherAccountID)

        balanceUpdateA_M = accountM.updateBalance(ring.orderA.tokenB, fee_A - protocolFee_A - rebate_A)
        balanceUpdateB_M = accountM.updateBalance(ring.orderB.tokenB, fee_B - protocolFee_B - rebate_B)
        balanceUpdateO_M = accountM.updateBalance(ring.tokenID, -feeToOperator)
        accountM.nonce += 1

        self.updateAccountTree(ring.ringMatcherAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.ringMatcherAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_M = AccountUpdateData(ring.ringMatcherAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Protocol fee payment
        balanceUpdateA_P = self.getAccount(0).updateBalance(ring.orderA.tokenB, protocolFee_A)
        balanceUpdateB_P = self.getAccount(0).updateBalance(ring.orderB.tokenB, protocolFee_B)
        ###

        # Operator payment
        # This is done after all rings are settled

        return RingSettlement(ring,
                              accountsMerkleRoot,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                              balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                              balanceUpdateA_M, balanceUpdateB_M, balanceUpdateO_M, accountUpdate_M,
                              balanceUpdateA_P, balanceUpdateB_P,
                              None,
                              feeToOperator)


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

    def onchainWithdraw(self, exchangeID, accountID, tokenID, amountRequested, shutdown):
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
                         exchangeID, accountID, tokenID, amountRequested,
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
        # This is done after all withdrawals are processed

        withdrawal = OffchainWithdrawal(exchangeID,
                                        accountID, tokenID, amountRequested, fAmountWithdrawn,
                                        walletAccountID, feeTokenID, fee, walletSplitPercentage,
                                        balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                                        balanceUpdateF_W, accountUpdate_W,
                                        None,
                                        feeToOperator, nonce)
        return withdrawal

    def cancelOrder(self,
                    exchangeID, accountID, orderTokenID, orderID, walletAccountID,
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
        # This is done after all cancellations are processed

        cancellation = Cancellation(exchangeID,
                                    accountID, orderTokenID, orderID, walletAccountID,
                                    feeTokenID, fee, walletSplitPercentage,
                                    nonce,
                                    tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                                    balanceUpdateF_W, accountUpdate_W,
                                    None,
                                    feeToOperator)
        return cancellation

    def createWithdrawProof(self, exchangeID, accountID, tokenID):
        account = copyAccountInfo(self.getAccount(accountID))
        balance = copyBalanceInfo(self.getAccount(accountID)._balancesLeafs[str(tokenID)])
        accountProof = self._accountsTree.createProof(accountID)
        balanceProof = self.getAccount(accountID)._balancesTree.createProof(tokenID)

        return WithdrawProof(exchangeID, accountID, tokenID,
                             account, balance,
                             self.getRoot(),
                             accountProof, balanceProof)

    def updateAccountTree(self, accountID):
        self._accountsTree.update(accountID, self.getAccount(accountID).hash())

    def getRoot(self):
        return self._accountsTree._root

