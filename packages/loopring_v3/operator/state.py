import sys
import json
import copy
from collections import namedtuple

from sparse_merkle_tree import SparseMerkleTree
from float import *

from ethsnarks.eddsa import PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.merkletree import MerkleTree
from ethsnarks.poseidon import poseidon, poseidon_params
from ethsnarks.field import SNARK_SCALAR_FIELD

poseidonParamsAccount = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsBalance = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsTradingHistory = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)

TREE_DEPTH_TRADING_HISTORY = 14
TREE_DEPTH_ACCOUNTS = 24
TREE_DEPTH_TOKENS = 8

MAX_AMOUNT = 2 ** 96 - 1

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
    return Account(Point(0, 0))

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
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY // 2, 4)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}
        # print("Empty trading tree: " + str(self._tradingHistoryTree._root))

    def hash(self):
        return poseidon([int(self.balance), int(self._tradingHistoryTree._root)], poseidonParamsBalance)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]
        # Trading history
        tradeHistoryLeafsDict = jBalance["_tradeHistoryLeafs"]
        for key, val in tradeHistoryLeafsDict.items():
            self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["orderID"])
        self._tradingHistoryTree._root = jBalance["_tradingHistoryTree"]["_root"]
        self._tradingHistoryTree._db.kv = jBalance["_tradingHistoryTree"]["_db"]["kv"]

    def getTradeHistory(self, orderID):
        address = int(orderID) % (2 ** TREE_DEPTH_TRADING_HISTORY)
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            return TradeHistoryLeaf()
        else:
            return self._tradeHistoryLeafs[str(address)]

    def updateTradeHistory(self, orderID, filled):
        address = int(orderID) % (2 ** TREE_DEPTH_TRADING_HISTORY)
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            self._tradeHistoryLeafs[str(address)] = TradeHistoryLeaf(0, 0)

        leafBefore = copy.deepcopy(self._tradeHistoryLeafs[str(address)])
        rootBefore = self._tradingHistoryTree._root
        #print("leafBefore: " + str(leafBefore))
        self._tradeHistoryLeafs[str(address)].filled = str(filled)
        self._tradeHistoryLeafs[str(address)].orderID = str(orderID)
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
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY // 2, 4)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}


class TradeHistoryLeaf(object):
    def __init__(self, filled = 0, orderID = 0):
        self.filled = str(filled)
        self.orderID = str(orderID)

    def hash(self):
        return poseidon([int(self.filled), int(self.orderID)], poseidonParamsTradingHistory)

    def fromJSON(self, jAccount):
        self.filled = jAccount["filled"]
        self.orderID = jAccount["orderID"]


class Account(object):
    def __init__(self, publicKey):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.nonce = 0
        # Balances
        self._balancesTree = SparseMerkleTree(TREE_DEPTH_TOKENS // 2, 4)
        self._balancesTree.newTree(BalanceLeaf().hash())
        self._balancesLeafs = {}
        #print("Empty balances tree: " + str(self._balancesTree._root))

    def hash(self):
        return poseidon([int(self.publicKeyX), int(self.publicKeyY), int(self.nonce), int(self._balancesTree._root)], poseidonParamsAccount)

    def fromJSON(self, jAccount):
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
        if int(self._balancesLeafs[str(tokenID)].balance) > MAX_AMOUNT:
            self._balancesLeafs[str(tokenID)].balance = str(MAX_AMOUNT)
        if shutdown:
            self._balancesLeafs[str(tokenID)].resetTradeHistory()

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter)

    def updateBalanceAndTradeHistory(self, tokenID, orderID, amount, filled):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update filled amounts
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, filled)
        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + amount)
        if int(self._balancesLeafs[str(tokenID)].balance) > MAX_AMOUNT:
            self._balancesLeafs[str(tokenID)].balance = str(MAX_AMOUNT)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return (BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter),
                tradeHistoryUpdate)

def write_proof(proof):
    # return [[str(_) for _ in proof_level] for proof_level in proof]
    return [str(_) for _ in proof]

class TradeHistoryUpdateData(object):
    def __init__(self,
                 orderID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.orderID = str(orderID)
        self.proof = write_proof(proof)
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
        self.proof = write_proof(proof)
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
        self.proof = write_proof(proof)
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
                 publicKeyX, publicKeyY,
                 exchangeID, orderID, accountID,
                 tokenS, tokenB,
                 amountS, amountB,
                 allOrNone, validSince, validUntil, buy,
                 maxFeeBips, feeBips, rebateBips):
        self.publicKeyX = str(publicKeyX)
        self.publicKeyY = str(publicKeyY)

        self.exchangeID = int(exchangeID)
        self.orderID = str(orderID)
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

        valid = valid and self.checkFillRate(int(order.amountS), int(order.amountB), fillAmountS, fillAmountB)

        valid = valid and not (not self.buy and self.allOrNone and fillAmountS < int(order.amountS))
        valid = valid and not (self.buy and self.allOrNone and fillAmountB < int(order.amountB))
        valid = valid and ((fillAmountS == 0 and fillAmountB == 0) or (fillAmountS != 0 and fillAmountB != 0))

        self.valid = valid

    def checkFillRate(self, amountS, amountB, fillAmountS, fillAmountB):
        # Return true if the fill rate <= 0.1% worse than the target rate
        # (fillAmountS/fillAmountB) * 1000 <= (amountS/amountB) * 1001
        return (fillAmountS * amountB * 1000) <= (fillAmountB * amountS * 1001)

class Ring(object):
    def __init__(self, orderA, orderB):
        self.orderA = orderA
        self.orderB = orderB

class RingSettlement(object):
    def __init__(self,
                 ring,
                 accountsMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                 balanceUpdateA_P, balanceUpdateB_P,
                 balanceDeltaA_O, balanceDeltaB_O):
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

        self.balanceUpdateA_P = balanceUpdateA_P
        self.balanceUpdateB_P = balanceUpdateB_P

        self.balanceDeltaA_O = balanceDeltaA_O
        self.balanceDeltaB_O = balanceDeltaB_O


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
                 feeTokenID, fee,
                 feeValue,
                 balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                 balanceUpdateF_O,
                 nonce):
        self.exchangeID = exchangeID

        self.accountID = accountID
        self.tokenID = tokenID
        self.amountRequested = str(amountRequested)
        self.fAmountWithdrawn = int(fAmountWithdrawn)

        self.feeTokenID = feeTokenID
        self.fee = str(fee)

        self.feeValue = feeValue

        self.balanceUpdateF_A = balanceUpdateF_A
        self.balanceUpdateW_A = balanceUpdateW_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateF_O = balanceUpdateF_O

        self.nonce = nonce

class InternalTransfer(object):
    def __init__(self,
                 exchangeID,
                 accountFromID, accountToID,
                 transTokenID, amountRequested, fAmountTrans,
                 feeTokenID, fee, type,
                 nonceFrom, nonceTo,
                 feeValue,
                 balanceUpdateF_From, balanceUpdateT_From, accountUpdate_From,
                 balanceUpdateT_To, accountUpdate_To,
                 balanceUpdateF_O):
        self.exchangeID = exchangeID

        self.accountFromID = accountFromID
        self.accountToID = accountToID
        self.transTokenID = transTokenID
        self.amountRequested = str(amountRequested)
        self.fAmountTrans = str(fAmountTrans)
        self.feeTokenID = feeTokenID
        self.fee = str(fee)
        self.type = int(type)
        self.nonceFrom = nonceFrom
        self.nonceTo = nonceTo

        self.feeValue = feeValue

        self.balanceUpdateF_From = balanceUpdateF_From
        self.balanceUpdateT_From = balanceUpdateT_From
        self.accountUpdate_From = accountUpdate_From

        self.balanceUpdateT_To = balanceUpdateT_To
        self.accountUpdate_To = accountUpdate_To

        self.balanceUpdateF_O = balanceUpdateF_O

class State(object):
    def __init__(self, exchangeID):
        self.exchangeID = int(exchangeID)
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS // 2, 4)
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
        numSlots = (2 ** TREE_DEPTH_TRADING_HISTORY)
        tradeHistoryOrderId = tradeHistory.orderID if int(tradeHistory.orderID) > 0 else int(order.orderID) % numSlots
        filled = int(tradeHistory.filled) if (int(order.orderID) == int(tradeHistoryOrderId)) else 0
        overwrite = 1 if (int(order.orderID) == int(tradeHistoryOrderId) + numSlots) else 0

        """
        print("tradeHistory.orderID: " + str(tradeHistory.orderID))
        print("order.orderID: " + str(order.orderID))
        print("filled: " + str(filled))
        print("overwrite: " + str(overwrite))
        """

        # Scale the order
        balanceS = int(account.getBalance(order.tokenS))

        limit = int(order.amountB) if order.buy else int(order.amountS)
        filledLimited = limit if limit < filled else filled
        remaining = limit - filledLimited
        remainingS_buy = remaining * int(order.amountS) // int(order.amountB)
        remainingS = remainingS_buy if order.buy else remaining
        fillAmountS = balanceS if balanceS < remainingS else remainingS
        fillAmountB = fillAmountS * int(order.amountB) // int(order.amountS)
        return (Fill(fillAmountS, fillAmountB), filled, overwrite)

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

        (fillA, filled_A, overwriteTradeHistorySlotA) = self.getMaxFillAmounts(ring.orderA)
        (fillB, filled_B, overwriteTradeHistorySlotB) = self.getMaxFillAmounts(ring.orderB)

        #'''
        print("fillA.S: " + str(fillA.S))
        print("fillA.B: " + str(fillA.B))
        print("fillB.S: " + str(fillB.S))
        print("fillB.B: " + str(fillB.B))
        print("-------------")
        #'''

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
        print("ring.orderA.valid " + str(ring.orderA.valid))
        print("ring.orderB.valid " + str(ring.orderB.valid))
        #if ring.valid == False:
            #print("ring.valid false: ")
            #fillA.S = 0
            #fillA.B = 0
            #fillB.S = 0
            #fillB.B = 0

        # Saved in ring for tests
        ring.fFillS_A = toFloat(fillA.S, Float24Encoding)
        ring.fFillS_B = toFloat(fillB.S, Float24Encoding)
        ring.overwriteTradeHistorySlotA = overwriteTradeHistorySlotA
        ring.overwriteTradeHistorySlotB = overwriteTradeHistorySlotB

        fillA.S = roundToFloatValue(fillA.S, Float24Encoding)
        fillB.S = roundToFloatValue(fillB.S, Float24Encoding)
        fillA.B = fillB.S
        fillB.B = fillA.S

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
            filled_A + (fillA.B if ring.orderA.buy else fillA.S)
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
            filled_B + (fillB.B if ring.orderB.buy else fillB.S)
        )
        balanceUpdateB_B = accountB.updateBalance(ring.orderB.tokenB, fillB.B - fee_B + rebate_B)

        self.updateAccountTree(ring.orderB.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(ring.orderB.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Protocol fee payment
        balanceUpdateA_P = self.getAccount(0).updateBalance(ring.orderA.tokenB, protocolFee_A)
        balanceUpdateB_P = self.getAccount(0).updateBalance(ring.orderB.tokenB, protocolFee_B)
        ###

        # Operator payment
        balanceDeltaA_O = fee_A - protocolFee_A - rebate_A
        balanceDeltaB_O = fee_B - protocolFee_B - rebate_B
        # The Merkle tree update is done after all rings are settled

        return RingSettlement(ring,
                              accountsMerkleRoot,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                              balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                              balanceUpdateA_P, balanceUpdateB_P,
                              balanceDeltaA_O, balanceDeltaB_O)


    def deposit(self, accountID, publicKeyX, publicKeyY, token, amount):
        # Copy the initial merkle root
        rootBefore = self._accountsTree._root

        if not(str(accountID) in self._accounts):
            accountBefore = copyAccountInfo(getDefaultAccount())
        else:
            accountBefore = copyAccountInfo(self.getAccount(accountID))

        proof = self._accountsTree.createProof(accountID)

        # Create the account if necessary
        if not(str(accountID) in self._accounts):
            self._accounts[str(accountID)] = Account(Point(publicKeyX, publicKeyY))

        account = self.getAccount(accountID)
        balanceUpdate = account.updateBalance(token, amount)

        # Update keys
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

            fAmount = toFloat(uAmount, Float24Encoding)
            amount = fromFloat(fAmount, Float24Encoding)

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
                         operatorAccountID, feeTokenID, fee):
        feeValue = roundToFloatValue(fee, Float16Encoding)

        # Update account
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountID)

        balanceUpdateF_A = self.getAccount(accountID).updateBalance(feeTokenID, -feeValue)

        balance = int(self.getAccount(accountID).getBalance(tokenID))
        uAmountWithdrawn = int(amountRequested) if (int(amountRequested) < balance) else balance

        fAmountWithdrawn = toFloat(uAmountWithdrawn, Float24Encoding)
        amountWithdrawn = fromFloat(fAmountWithdrawn, Float24Encoding)

        balanceUpdateW_A = self.getAccount(accountID).updateBalance(tokenID, -amountWithdrawn)
        self.getAccount(accountID).nonce += 1

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Operator payment
        # This is done after all withdrawals are processed

        withdrawal = OffchainWithdrawal(exchangeID,
                                        accountID, tokenID, amountRequested, fAmountWithdrawn,
                                        feeTokenID, fee,
                                        feeValue,
                                        balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                                        None,
                                        nonce)
        return withdrawal

    def internalTransfer(self,
                    exchangeID, operatorAccountID, accountFromID, accountToID,
                    transTokenID, amountRequested, feeTokenID, fee, type):

        feeValue = roundToFloatValue(fee, Float16Encoding)

        # Update account From
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountFromID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountFromID)

        balanceUpdateF_From = self.getAccount(accountFromID).updateBalance(feeTokenID, -feeValue)

        fAmountTrans = toFloat(amountRequested, Float24Encoding)
        amountTrans = fromFloat(fAmountTrans, Float24Encoding)
        balanceUpdateT_From = self.getAccount(accountFromID).updateBalance(transTokenID, -amountTrans)

        if type == 0:
            self.getAccount(accountFromID).nonce += 1

        self.updateAccountTree(accountFromID)
        accountAfter = copyAccountInfo(self.getAccount(accountFromID))
        rootAfter = self._accountsTree._root
        accountUpdate_From = AccountUpdateData(accountFromID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

        # Update account To
        rootToBefore = self._accountsTree._root
        accountToBefore = copyAccountInfo(self.getAccount(accountToID))
        nonceTo = accountToBefore.nonce
        proofTo = self._accountsTree.createProof(accountToID)

        accountTo = self.getAccount(accountToID)
        balanceUpdateT_To = accountTo.updateBalance(transTokenID, amountTrans)

        self.updateAccountTree(accountToID)
        accountToAfter = copyAccountInfo(self.getAccount(accountToID))
        rootToAfter = self._accountsTree._root
        accountUpdate_To = AccountUpdateData(accountToID, proofTo, rootToBefore, rootToAfter, accountToBefore, accountToAfter)

        # Operator payment
        # This is done after all internal transfer are processed

        internalTrans = InternalTransfer(exchangeID,
                                         accountFromID, accountToID,
                                         transTokenID, amountRequested, fAmountTrans,
                                         feeTokenID, fee, type,
                                         nonce, nonceTo,
                                         feeValue,
                                         balanceUpdateF_From, balanceUpdateT_From, accountUpdate_From,
                                         balanceUpdateT_To, accountUpdate_To,
                                         None)
        return internalTrans

    def updateAccountTree(self, accountID):
        self._accountsTree.update(accountID, self.getAccount(accountID).hash())

    def getRoot(self):
        return self._accountsTree._root

