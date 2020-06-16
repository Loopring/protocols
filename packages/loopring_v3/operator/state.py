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

poseidonParamsAccount = poseidon_params(SNARK_SCALAR_FIELD, 6, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsBalance = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsTradingHistory = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)

BINARY_TREE_DEPTH_TRADING_HISTORY = 14
BINARY_TREE_DEPTH_ACCOUNTS = 24
BINARY_TREE_DEPTH_TOKENS = 12

MAX_AMOUNT = 2 ** 96 - 1

class GeneralObject(object):
    pass

def setValue(value, default):
    return default if value is None else value

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
        self.numConditionalTransactions = int(0)

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
        self._tradingHistoryTree = SparseMerkleTree(BINARY_TREE_DEPTH_TRADING_HISTORY // 2, 4)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}
        # print("Empty trading tree: " + str(self._tradingHistoryTree._root))


    def hash(self):
        #print("balance: " + self.balance)
        temp = [int(self.balance), int(self._tradingHistoryTree._root)]
        #print(temp)
        return poseidon(temp, poseidonParamsBalance)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]
        # Trading history
        tradeHistoryLeafsDict = jBalance["_tradeHistoryLeafs"]
        for key, val in tradeHistoryLeafsDict.items():
            self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["orderID"])
        self._tradingHistoryTree._root = jBalance["_tradingHistoryTree"]["_root"]
        self._tradingHistoryTree._db.kv = jBalance["_tradingHistoryTree"]["_db"]["kv"]

    def getTradeHistory(self, orderID):
        address = int(orderID) % (2 ** BINARY_TREE_DEPTH_TRADING_HISTORY)
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            return TradeHistoryLeaf()
        else:
            return self._tradeHistoryLeafs[str(address)]

    def updateTradeHistory(self, orderID, filled):
        address = int(orderID) % (2 ** BINARY_TREE_DEPTH_TRADING_HISTORY)
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
        self._tradingHistoryTree = SparseMerkleTree(BINARY_TREE_DEPTH_TRADING_HISTORY // 2, 4)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}


class TradeHistoryLeaf(object):
    def __init__(self, filled = 0, orderID = 0):
        self.filled = str(filled)
        self.orderID = str(orderID)

    def hash(self):
        return poseidon([int(self.filled), int(self.orderID)], poseidonParamsTradingHistory)

    def fromJSON(self, jBalance):
        self.filled = jBalance["filled"]
        self.orderID = jBalance["orderID"]

class Account(object):
    def __init__(self, owner, publicKey):
        self.owner = str(owner)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.nonce = 0
        # Balances
        self._balancesTree = SparseMerkleTree(BINARY_TREE_DEPTH_TOKENS // 2, 4)
        self._balancesTree.newTree(BalanceLeaf().hash())
        self._balancesLeafs = {}
        #print("Empty balances tree: " + str(self._balancesTree._root))

    def hash(self):
        return poseidon([int(self.owner), int(self.publicKeyX), int(self.publicKeyY), int(self.nonce), int(self._balancesTree._root)], poseidonParamsAccount)

    def fromJSON(self, jAccount):
        self.owner = jAccount["owner"]
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

    def updateBalance(self, tokenID, deltaBalance):
        # Make sure the leaf exists in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + int(deltaBalance))

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter)

    def updateBalanceAndTradeHistory(self, tokenID, orderID, filled, delta_balance):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update filled amounts
        tradeHistoryUpdate = self._balancesLeafs[str(tokenID)].updateTradeHistory(orderID, filled)
        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + int(delta_balance))

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
                 maxFeeBips, feeBips, rebateBips,
                 transferAmountTrade, reduceOnly, triggerPrice,
                 transferAmount, transferFee):
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

        self.transferAmountTrade = transferAmountTrade
        self.reduceOnly = reduceOnly
        self.triggerPrice = triggerPrice

        self.transferAmount = transferAmount
        self.transferFee = transferFee

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

class TxWitness(object):
    def __init__(self, witness, input):
        self.witness = witness
        self.input = input

class Witness(object):
    def __init__(self,
                 signatureA, signatureB,
                 accountsMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                 balanceUpdateA_P, balanceUpdateB_P,
                 balanceO_A_Address, balanceO_B_Address,
                 balanceDeltaA_O, balanceDeltaB_O):
        if signatureA is not None:
            self.signatureA = signatureA
        if signatureB is not None:
            self.signatureB = signatureB

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

        self.balanceO_A_Address = balanceO_A_Address
        self.balanceO_B_Address = balanceO_B_Address

        self.balanceDeltaA_O = balanceDeltaA_O
        self.balanceDeltaB_O = balanceDeltaB_O


class State(object):
    def __init__(self, exchangeID):
        self.exchangeID = int(exchangeID)
        # Accounts
        self._accountsTree = SparseMerkleTree(BINARY_TREE_DEPTH_ACCOUNTS // 2, 4)
        self._accountsTree.newTree(getDefaultAccount().hash())
        self._accounts = {}
        self._accounts[str(0)] = getDefaultAccount()
        self._accounts[str(1)] = getDefaultAccount()
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

    def getFilled(self, order):
        account = self.getAccount(order.accountID)
        tradeHistory = account.getBalanceLeaf(order.tokenS).getTradeHistory(int(order.orderID))

        # Trade history trimming
        numSlots = (2 ** BINARY_TREE_DEPTH_TRADING_HISTORY)
        tradeHistoryOrderId = tradeHistory.orderID if int(tradeHistory.orderID) > 0 else int(order.orderID) % numSlots
        filled = int(tradeHistory.filled) if (int(order.orderID) == int(tradeHistoryOrderId)) else 0
        overwrite = 1 if (int(order.orderID) == int(tradeHistoryOrderId) + numSlots) else 0

        return (filled, overwrite)

    def getMaxFill(self, order, filled, balanceLimit):
        account = self.getAccount(order.accountID)

        # Scale the order
        balanceS = int(account.getBalance(order.tokenS)) if balanceLimit else int(order.amountS)

        limit = int(order.amountB) if order.buy else int(order.amountS)
        filledLimited = limit if limit < filled else filled
        remaining = limit - filledLimited
        remainingS_buy = remaining * int(order.amountS) // int(order.amountB)
        remainingS = remainingS_buy if order.buy else remaining
        fillAmountS = balanceS if balanceS < remainingS else remainingS
        fillAmountB = fillAmountS * int(order.amountB) // int(order.amountS)
        return Fill(fillAmountS, fillAmountB)

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

    def executeTransaction(self, context, txInput):
        newState = GeneralObject()
        newState.signatureA = None
        newState.signatureB = None
        # A
        newState.accountA_Address = None
        newState.accountA_Owner = None
        newState.accountA_PublicKeyX = None
        newState.accountA_PublicKeyY = None
        newState.accountA_Nonce = None
        newState.balanceA_S_Address = None
        newState.balanceA_S_Balance = None
        newState.balanceA_B_Address = None
        newState.balanceA_B_Balance = None
        newState.tradeHistoryA_Address = None
        newState.tradeHistoryA_Filled = None
        newState.tradeHistoryA_OrderId = None
        # B
        newState.accountB_Address = None
        newState.accountB_Owner = None
        newState.accountB_PublicKeyX = None
        newState.accountB_PublicKeyY = None
        newState.accountB_Nonce = None
        newState.balanceB_S_Address = None
        newState.balanceB_S_Balance = None
        newState.balanceB_B_Address = None
        newState.balanceB_B_Balance = None
        newState.tradeHistoryB_Address = None
        newState.tradeHistoryB_Filled = None
        newState.tradeHistoryB_OrderId = None
        # Operator
        newState.balanceDeltaA_O = None
        newState.balanceDeltaB_O = None
        # Protocol fees
        #newState.balanceA_P_Address = None
        newState.balanceDeltaA_P = None
        #newState.balanceB_P_Address = None
        newState.balanceDeltaB_P = None

        if txInput.txType == "Noop":

            # Nothing to do
            pass

        elif txInput.txType == "SpotTrade":

            ring = txInput

            # Amount filled in the trade history
            (filled_A, overwriteTradeHistorySlotA) = self.getFilled(ring.orderA)
            (filled_B, overwriteTradeHistorySlotB) = self.getFilled(ring.orderB)

            # Simple matching logic
            fillA = self.getMaxFill(ring.orderA, filled_A, True)
            fillB = self.getMaxFill(ring.orderB, filled_B, True)
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

            newState.signatureA = ring.orderA.signature
            newState.signatureB = ring.orderB.signature

            newState.accountA_Address = ring.orderA.accountID
            accountA = self.getAccount(ring.orderA.accountID)

            newState.accountA_Nonce = accountA.nonce

            newState.balanceA_S_Address = ring.orderA.tokenS
            newState.balanceA_S_Balance = -fillA.S

            newState.balanceA_B_Address = ring.orderA.tokenB
            newState.balanceA_B_Balance = fillA.B - fee_A + rebate_A

            newState.tradeHistoryA_Address = ring.orderA.orderID
            newState.tradeHistoryA_Filled = filled_A + (fillA.B if ring.orderA.buy else fillA.S)
            newState.tradeHistoryA_OrderId = ring.orderA.orderID


            newState.accountB_Address = ring.orderB.accountID
            accountB = self.getAccount(ring.orderB.accountID)

            newState.accountB_Nonce = accountB.nonce

            newState.balanceB_S_Address = ring.orderB.tokenS
            newState.balanceB_S_Balance = -fillB.S

            newState.balanceB_B_Address = ring.orderB.tokenB
            newState.balanceB_B_Balance = fillB.B - fee_B + rebate_B

            newState.tradeHistoryB_Address = ring.orderB.orderID
            newState.tradeHistoryB_Filled = filled_B + (fillB.B if ring.orderB.buy else fillB.S)
            newState.tradeHistoryB_OrderId = ring.orderB.orderID

            newState.balanceDeltaA_O = fee_A - protocolFee_A - rebate_A
            newState.balanceDeltaB_O = fee_B - protocolFee_B - rebate_B

            newState.balanceDeltaA_P = protocolFee_A
            newState.balanceDeltaB_P = protocolFee_B

        elif txInput.txType == "Transfer":

            transferAmount = roundToFloatValue(int(txInput.amount), Float24Encoding)
            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            newState.signatureA = txInput.signature

            newState.accountA_Address = txInput.accountFromID
            accountA = self.getAccount(newState.accountA_Address)

            newState.balanceA_S_Address = txInput.transTokenID
            newState.balanceA_S_Balance = -transferAmount

            newState.balanceA_B_Address = txInput.feeTokenID
            newState.balanceA_B_Balance = -feeValue

            newState.accountB_Address = txInput.accountToID
            accountB = self.getAccount(newState.accountB_Address)
            newState.accountB_Owner = txInput.ownerTo

            newState.balanceB_B_Address = txInput.transTokenID
            newState.balanceB_B_Balance = transferAmount

            newState.accountA_Nonce = accountA.nonce + 1

            if txInput.type != 0:
                context.numConditionalTransactions = context.numConditionalTransactions + 1

            newState.balanceDeltaA_O = feeValue

        elif txInput.txType == "Withdraw":

            ## calculate how much can be withdrawn
            account = self.getAccount(txInput.accountID)
            if int(txInput.type) == 2:
                txInput.amountWithdrawn = str(0)
            else:
                balance = int(account.getBalance(txInput.tokenID))
                txInput.amountWithdrawn = str(int(txInput.amount) if int(txInput.amount) <= balance else balance)

            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            newState.signatureA = txInput.signature

            newState.accountA_Address = txInput.accountID
            accountA = self.getAccount(newState.accountA_Address)

            newState.balanceA_S_Address = txInput.tokenID
            newState.balanceA_S_Balance = -int(txInput.amountWithdrawn)

            newState.balanceA_B_Address = txInput.feeTokenID
            newState.balanceA_B_Balance = -feeValue

            newState.accountA_Nonce = accountA.nonce + 1

            newState.balanceDeltaA_O = feeValue

            context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "Deposit":

            newState.accountA_Address = txInput.accountID
            newState.accountA_Owner = txInput.owner

            newState.balanceA_S_Address = txInput.tokenID
            newState.balanceA_S_Balance = txInput.amount

            context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "PublicKeyUpdate":

            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            accountA = self.getAccount(newState.accountA_Address)
            newState.accountA_Address = txInput.accountID
            newState.accountA_PublicKeyX = txInput.publicKeyX
            newState.accountA_PublicKeyY = txInput.publicKeyY
            newState.accountA_Nonce = accountA.nonce + 1

            newState.balanceA_S_Address = txInput.feeTokenID
            newState.balanceA_S_Balance = -feeValue

            newState.balanceDeltaB_O = feeValue

            context.numConditionalTransactions = context.numConditionalTransactions + 1


        # Set default values if none provided
        # A
        newState.accountA_Address = setValue(newState.accountA_Address, 1)
        accountA = self.getAccount(newState.accountA_Address)
        newState.accountA_Owner = setValue(newState.accountA_Owner, accountA.owner)
        newState.accountA_PublicKeyX = setValue(newState.accountA_PublicKeyX, accountA.publicKeyX)
        newState.accountA_PublicKeyY = setValue(newState.accountA_PublicKeyY, accountA.publicKeyY)
        newState.accountA_Nonce = setValue(newState.accountA_Nonce, accountA.nonce)


        newState.balanceA_S_Address = setValue(newState.balanceA_S_Address, 0)
        balanceLeafA_S = accountA.getBalanceLeaf(newState.balanceA_S_Address)
        newState.balanceA_S_Balance = setValue(newState.balanceA_S_Balance, 0)

        newState.balanceA_B_Address = setValue(newState.balanceA_B_Address, 0)
        newState.balanceA_B_Balance = setValue(newState.balanceA_B_Balance, 0)

        newState.tradeHistoryA_Address = setValue(newState.tradeHistoryA_Address, 0)
        tradeHistoryA = balanceLeafA_S.getTradeHistory(newState.tradeHistoryA_Address)
        newState.tradeHistoryA_Filled = setValue(newState.tradeHistoryA_Filled, tradeHistoryA.filled)
        newState.tradeHistoryA_OrderId = setValue(newState.tradeHistoryA_OrderId, tradeHistoryA.orderID)

        # B
        newState.accountB_Address = setValue(newState.accountB_Address, 1)
        accountB = self.getAccount(newState.accountB_Address)
        newState.accountB_Owner = setValue(newState.accountB_Owner, accountB.owner)
        newState.accountB_PublicKeyX = setValue(newState.accountB_PublicKeyX, accountB.publicKeyX)
        newState.accountB_PublicKeyY = setValue(newState.accountB_PublicKeyY, accountB.publicKeyY)
        newState.accountB_Nonce = setValue(newState.accountB_Nonce, accountB.nonce)


        newState.balanceB_S_Address = setValue(newState.balanceB_S_Address, 0)
        balanceLeafB_S = accountB.getBalanceLeaf(newState.balanceB_S_Address)
        newState.balanceB_S_Balance = setValue(newState.balanceB_S_Balance, 0)

        newState.balanceB_B_Address = setValue(newState.balanceB_B_Address, 0)
        newState.balanceB_B_Balance = setValue(newState.balanceB_B_Balance, 0)

        newState.tradeHistoryB_Address = setValue(newState.tradeHistoryB_Address, 0)
        tradeHistoryB = balanceLeafB_S.getTradeHistory(newState.tradeHistoryB_Address)
        newState.tradeHistoryB_Filled = setValue(newState.tradeHistoryB_Filled, tradeHistoryB.filled)
        newState.tradeHistoryB_OrderId = setValue(newState.tradeHistoryB_OrderId, tradeHistoryB.orderID)

        # Operator
        newState.balanceDeltaA_O = setValue(newState.balanceDeltaA_O, 0)
        newState.balanceDeltaB_O = setValue(newState.balanceDeltaB_O, 0)

        # Protocol fees
        newState.balanceDeltaA_P = setValue(newState.balanceDeltaA_P, 0)
        newState.balanceDeltaB_P = setValue(newState.balanceDeltaB_P, 0)


        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        # Update balances A
        accountA = self.getAccount(newState.accountA_Address)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(newState.accountA_Address))
        proof = self._accountsTree.createProof(newState.accountA_Address)

        (balanceUpdateS_A, tradeHistoryUpdate_A) = accountA.updateBalanceAndTradeHistory(
            newState.balanceA_S_Address,
            newState.tradeHistoryA_OrderId,
            newState.tradeHistoryA_Filled,
            newState.balanceA_S_Balance
        )
        balanceUpdateB_A = accountA.updateBalance(
            newState.balanceA_B_Address,
            newState.balanceA_B_Balance
        )

        accountA.owner = newState.accountA_Owner
        accountA.publicKeyX = newState.accountA_PublicKeyX
        accountA.publicKeyY = newState.accountA_PublicKeyY
        accountA.nonce = newState.accountA_Nonce

        self.updateAccountTree(newState.accountA_Address)
        accountAfter = copyAccountInfo(self.getAccount(newState.accountA_Address))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(newState.accountA_Address, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update balances B
        accountB = self.getAccount(newState.accountB_Address)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(newState.accountB_Address))
        proof = self._accountsTree.createProof(newState.accountB_Address)

        (balanceUpdateS_B, tradeHistoryUpdate_B) = accountB.updateBalanceAndTradeHistory(
            newState.balanceB_S_Address,
            newState.tradeHistoryB_OrderId,
            newState.tradeHistoryB_Filled,
            newState.balanceB_S_Balance
        )
        balanceUpdateB_B = accountB.updateBalance(
            newState.balanceB_B_Address,
            newState.balanceB_B_Balance
        )

        accountB.owner = newState.accountB_Owner
        accountB.publicKeyX = newState.accountB_PublicKeyX
        accountB.publicKeyY = newState.accountB_PublicKeyY
        accountB.nonce = newState.accountB_Nonce

        self.updateAccountTree(newState.accountB_Address)
        accountAfter = copyAccountInfo(self.getAccount(newState.accountB_Address))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(newState.accountB_Address, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Protocol fee payment
        balanceUpdateA_P = self.getAccount(0).updateBalance(newState.balanceA_B_Address, newState.balanceDeltaA_P)
        balanceUpdateB_P = self.getAccount(0).updateBalance(newState.balanceB_B_Address, newState.balanceDeltaB_P)
        ###

        # Operator payment
        # The Merkle tree update is done after all rings are settled

        witness = Witness(newState.signatureA, newState.signatureB,
                          accountsMerkleRoot,
                          tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                          balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                          balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                          balanceUpdateA_P, balanceUpdateB_P,
                          newState.balanceA_B_Address, newState.balanceB_B_Address,
                          newState.balanceDeltaA_O, newState.balanceDeltaB_O)

        return TxWitness(witness, txInput)

    def getAccount(self, accountID):
        # Make sure the leaf exist in our map
        if not(str(accountID) in self._accounts):
            # print("Account doesn't exist: " + str(accountID))
            self._accounts[str(accountID)] = Account(0, Point(0, 0))
        return self._accounts[str(accountID)]

    def updateAccountTree(self, accountID):
        self._accountsTree.update(accountID, self.getAccount(accountID).hash())

    def getRoot(self):
        return self._accountsTree._root

