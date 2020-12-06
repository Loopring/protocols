import sys
import json
import copy
from collections import namedtuple
from math import *

from sparse_merkle_tree import SparseMerkleTree
from float import *

from ethsnarks.eddsa import PureEdDSA
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ
from ethsnarks.merkletree import MerkleTree
from ethsnarks.poseidon import poseidon, poseidon_params
from ethsnarks.field import SNARK_SCALAR_FIELD

poseidonParamsAccount = poseidon_params(SNARK_SCALAR_FIELD, 7, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsBalance = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)
poseidonParamsStorage = poseidon_params(SNARK_SCALAR_FIELD, 5, 6, 52, b'poseidon', 5, security_target=128)

BINARY_TREE_DEPTH_STORAGE = 14
BINARY_TREE_DEPTH_ACCOUNTS = 32
BINARY_TREE_DEPTH_TOKENS = 16

MAX_AMOUNT = 2 ** 96 - 1

class GeneralObject(object):
    pass

def setValue(value, default):
    return default if value is None else value

def copyBalanceInfo(leaf):
    c = copy.deepcopy(leaf)
    c.storageRoot = str(leaf._storageTree._root)
    c._storageTree = None
    c._storageLeafs = None
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
    def __init__(self, balance = 0, weightAMM = 0):
        self.balance = str(balance)
        self.weightAMM = str(weightAMM)
        # Storage
        self._storageTree = SparseMerkleTree(BINARY_TREE_DEPTH_STORAGE // 2, 4)
        self._storageTree.newTree(StorageLeaf().hash())
        self._storageLeafs = {}
        #print("Empty storage tree: " + str(self._storageTree._root))


    def hash(self):
        #print("balance: " + self.balance)
        temp = [int(self.balance), int(self.weightAMM), int(self._storageTree._root)]
        #print(temp)
        return poseidon(temp, poseidonParamsBalance)

    def fromJSON(self, jBalance):
        self.balance = jBalance["balance"]
        self.weightAMM = jBalance["weightAMM"]
        # Storage
        storageLeafsDict = jBalance["_storageLeafs"]
        for key, val in storageLeafsDict.items():
            self._storageLeafs[key] = StorageLeaf(val["data"], val["storageID"])
        self._storageTree._root = jBalance["_storageTree"]["_root"]
        self._storageTree._db.kv = jBalance["_storageTree"]["_db"]["kv"]

    def getStorage(self, storageID):
        address = int(storageID) % (2 ** BINARY_TREE_DEPTH_STORAGE)
        # Make sure the leaf exist in our map
        if not(str(address) in self._storageLeafs):
            return StorageLeaf()
        else:
            return self._storageLeafs[str(address)]

    def updateStorage(self, storageID, data):
        address = int(storageID) % (2 ** BINARY_TREE_DEPTH_STORAGE)
        # Make sure the leaf exist in our map
        if not(str(address) in self._storageLeafs):
            self._storageLeafs[str(address)] = StorageLeaf(0, 0)

        leafBefore = copy.deepcopy(self._storageLeafs[str(address)])
        rootBefore = self._storageTree._root
        #print("leafBefore: " + str(leafBefore))
        self._storageLeafs[str(address)].data = str(data)
        self._storageLeafs[str(address)].storageID = str(storageID)
        leafAfter = copy.deepcopy(self._storageLeafs[str(address)])
        #print("leafAfter: " + str(leafAfter))
        proof = self._storageTree.createProof(address)
        self._storageTree.update(address, leafAfter.hash())
        rootAfter = self._storageTree._root

        return StorageUpdateData(storageID, proof,
                                 rootBefore, rootAfter,
                                 leafBefore, leafAfter)


class StorageLeaf(object):
    def __init__(self, data = 0, storageID = 0):
        self.data = str(data)
        self.storageID = str(storageID)

    def hash(self):
        return poseidon([int(self.data), int(self.storageID)], poseidonParamsStorage)

    def fromJSON(self, jBalance):
        self.data = jBalance["data"]
        self.storageID = jBalance["storageID"]

class Account(object):
    def __init__(self, owner, publicKey):
        self.owner = str(owner)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.nonce = 0
        self.feeBipsAMM = 0
        # Balances
        self._balancesTree = SparseMerkleTree(BINARY_TREE_DEPTH_TOKENS // 2, 4)
        self._balancesTree.newTree(BalanceLeaf().hash())
        self._balancesLeafs = {}
        # print("Empty balances tree: " + str(self._balancesTree._root))

    def hash(self):
        return poseidon([int(self.owner), int(self.publicKeyX), int(self.publicKeyY), int(self.nonce), int(self.feeBipsAMM), int(self._balancesTree._root)], poseidonParamsAccount)

    def fromJSON(self, jAccount):
        self.owner = jAccount["owner"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.nonce = int(jAccount["nonce"])
        self.feeBipsAMM = int(jAccount["feeBipsAMM"])
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

    def updateBalanceAndStorage(self, tokenID, storageID, filled, delta_balance, weight = None):
        # Make sure the leaf exist in our map
        if not(str(tokenID) in self._balancesLeafs):
            self._balancesLeafs[str(tokenID)] = BalanceLeaf()

        balancesBefore = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        rootBefore = self._balancesTree._root

        # Update filled amounts
        storageUpdate = self._balancesLeafs[str(tokenID)].updateStorage(storageID, filled)
        self._balancesLeafs[str(tokenID)].balance = str(int(self._balancesLeafs[str(tokenID)].balance) + int(delta_balance))
        if weight is not None:
            self._balancesLeafs[str(tokenID)].weightAMM = str(weight)

        #print("str(delta_balance): " + str(delta_balance))
        #print("endBalance: " + self._balancesLeafs[str(tokenID)].balance)

        balancesAfter = copyBalanceInfo(self._balancesLeafs[str(tokenID)])
        proof = self._balancesTree.createProof(tokenID)
        self._balancesTree.update(tokenID, self._balancesLeafs[str(tokenID)].hash())
        rootAfter = self._balancesTree._root

        return (BalanceUpdateData(tokenID, proof,
                                 rootBefore, rootAfter,
                                 balancesBefore, balancesAfter),
                storageUpdate)

def write_proof(proof):
    # return [[str(_) for _ in proof_level] for proof_level in proof]
    return [str(_) for _ in proof]

class StorageUpdateData(object):
    def __init__(self,
                 storageID, proof,
                 rootBefore, rootAfter,
                 before, after):
        self.storageID = str(storageID)
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

class Order(object):
    def __init__(self,
                 publicKeyX, publicKeyY,
                 storageID, accountID,
                 tokenS, tokenB,
                 amountS, amountB,
                 validUntil, fillAmountBorS, taker,
                 maxFeeBips, feeBips,
                 amm):
        self.publicKeyX = str(publicKeyX)
        self.publicKeyY = str(publicKeyY)

        self.storageID = str(storageID)
        self.accountID = int(accountID)

        self.amountS = str(amountS)
        self.amountB = str(amountB)

        self.tokenS = tokenS
        self.tokenB = tokenB

        self.validUntil = validUntil
        self.fillAmountBorS = bool(fillAmountBorS)
        self.taker = str(taker)
        self.maxFeeBips = maxFeeBips

        self.feeBips = feeBips

        self.amm = bool(amm)

    def checkValid(self, context, order, fillAmountS, fillAmountB):
        valid = True
        valid = valid and (context.timestamp <= self.validUntil)
        valid = valid and self.checkFillRate(int(order.amountS), int(order.amountB), fillAmountS, fillAmountB)
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
                 storageUpdate_A, storageUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                 balanceUpdateA_O, balanceUpdateB_O, accountUpdate_O,
                 balanceUpdateA_P, balanceUpdateB_P):
        if signatureA is not None:
            self.signatureA = signatureA
        if signatureB is not None:
            self.signatureB = signatureB

        self.accountsMerkleRoot = str(accountsMerkleRoot)

        self.storageUpdate_A = storageUpdate_A
        self.storageUpdate_B = storageUpdate_B

        self.balanceUpdateS_A = balanceUpdateS_A
        self.balanceUpdateB_A = balanceUpdateB_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateS_B = balanceUpdateS_B
        self.balanceUpdateB_B = balanceUpdateB_B
        self.accountUpdate_B = accountUpdate_B

        self.balanceUpdateA_O = balanceUpdateA_O
        self.balanceUpdateB_O = balanceUpdateB_O
        self.accountUpdate_O = accountUpdate_O

        self.balanceUpdateA_P = balanceUpdateA_P
        self.balanceUpdateB_P = balanceUpdateB_P


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

    def calculateFees(self, amountB, feeBips, protocolFeeBips):
        protocolFee = (amountB * protocolFeeBips) // 100000
        fee = (amountB * feeBips) // 10000
        return (fee, protocolFee)

    def getData(self, accountID, tokenID, storageID):
        account = self.getAccount(accountID)
        storage = account.getBalanceLeaf(tokenID).getStorage(int(storageID))

        # Storage trimming
        numSlots = (2 ** BINARY_TREE_DEPTH_STORAGE)
        leafStorageID = storage.storageID if int(storage.storageID) > 0 else int(storageID) % numSlots
        filled = int(storage.data) if (int(storageID) == int(leafStorageID)) else 0

        return filled

    def getMaxFill(self, order, filled, balanceLimit):
        account = self.getAccount(order.accountID)

        # Scale the order
        balanceS = int(account.getBalance(order.tokenS)) if balanceLimit else int(order.amountS)

        limit = int(order.amountB) if order.fillAmountBorS else int(order.amountS)
        filledLimited = limit if limit < filled else filled
        remaining = limit - filledLimited
        remainingS_buy = remaining * int(order.amountS) // int(order.amountB)
        remainingS = remainingS_buy if order.fillAmountBorS else remaining
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
        # Tokens
        newState.TXV_BALANCE_A_S_ADDRESS = None
        newState.TXV_BALANCE_A_S_ADDRESS = None
        # A
        newState.TXV_ACCOUNT_A_ADDRESS = None
        newState.TXV_ACCOUNT_A_OWNER = None
        newState.TXV_ACCOUNT_A_PUBKEY_X = None
        newState.TXV_ACCOUNT_A_PUBKEY_Y = None
        newState.TXV_ACCOUNT_A_NONCE = None
        newState.TXV_ACCOUNT_A_FEEBIPSAMM = None
        newState.TXV_BALANCE_A_S_ADDRESS = None
        newState.TXV_BALANCE_A_S_BALANCE = None
        newState.TXV_BALANCE_A_S_WEIGHT = None
        newState.TXV_BALANCE_A_B_BALANCE = None
        newState.TXV_STORAGE_A_ADDRESS = None
        newState.TXV_STORAGE_A_DATA = None
        newState.TXV_STORAGE_A_STORAGEID = None
        # B
        newState.TXV_ACCOUNT_B_ADDRESS = None
        newState.TXV_ACCOUNT_B_OWNER = None
        newState.TXV_ACCOUNT_B_PUBKEY_X = None
        newState.TXV_ACCOUNT_B_PUBKEY_Y = None
        newState.TXV_ACCOUNT_B_NONCE = None
        newState.TXV_BALANCE_B_S_ADDRESS = None
        newState.TXV_BALANCE_B_S_BALANCE = None
        newState.TXV_BALANCE_B_B_BALANCE = None
        newState.TXV_STORAGE_B_ADDRESS = None
        newState.TXV_STORAGE_B_DATA = None
        newState.TXV_STORAGE_B_STORAGEID = None
        # Operator
        newState.balanceDeltaA_O = None
        newState.balanceDeltaB_O = None
        # Protocol fees
        newState.balanceDeltaA_P = None
        newState.balanceDeltaB_P = None

        if txInput.txType == "Noop":

            # Nothing to do
            pass

        elif txInput.txType == "SpotTrade":

            ring = txInput

            # Amount filled in the trade history
            filled_A = self.getData(ring.orderA.accountID, ring.orderA.tokenS, ring.orderA.storageID)
            filled_B = self.getData(ring.orderB.accountID, ring.orderB.tokenS, ring.orderB.storageID)

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
            if ring.orderA.fillAmountBorS:
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

            (fee_A, protocolFee_A) = self.calculateFees(
                fillA.B,
                ring.orderA.feeBips,
                context.protocolTakerFeeBips
            )

            (fee_B, protocolFee_B) = self.calculateFees(
                fillB.B,
                ring.orderB.feeBips,
                context.protocolMakerFeeBips
            )

            '''
            print("fee_A: " + str(fee_A))
            print("protocolFee_A: " + str(protocolFee_A))

            print("fee_B: " + str(fee_B))
            print("protocolFee_B: " + str(protocolFee_B))
            '''

            newState.signatureA = ring.orderA.signature
            newState.signatureB = ring.orderB.signature

            newState.TXV_ACCOUNT_A_ADDRESS = ring.orderA.accountID
            accountA = self.getAccount(ring.orderA.accountID)

            newState.TXV_BALANCE_A_S_ADDRESS = ring.orderA.tokenS
            newState.TXV_BALANCE_A_S_BALANCE = -fillA.S

            newState.TXV_BALANCE_B_S_ADDRESS = ring.orderA.tokenB
            newState.TXV_BALANCE_A_B_BALANCE = fillA.B - fee_A

            newState.TXV_STORAGE_A_ADDRESS = ring.orderA.storageID
            newState.TXV_STORAGE_A_DATA = filled_A + (fillA.B if ring.orderA.fillAmountBorS else fillA.S)
            newState.TXV_STORAGE_A_STORAGEID = ring.orderA.storageID


            newState.TXV_ACCOUNT_B_ADDRESS = ring.orderB.accountID
            accountB = self.getAccount(ring.orderB.accountID)

            newState.TXV_BALANCE_B_S_ADDRESS = ring.orderB.tokenS
            newState.TXV_BALANCE_B_S_BALANCE = -fillB.S

            newState.TXV_BALANCE_A_S_ADDRESS = ring.orderB.tokenB
            newState.TXV_BALANCE_B_B_BALANCE = fillB.B - fee_B

            newState.TXV_STORAGE_B_ADDRESS = ring.orderB.storageID
            newState.TXV_STORAGE_B_DATA = filled_B + (fillB.B if ring.orderB.fillAmountBorS else fillB.S)
            newState.TXV_STORAGE_B_STORAGEID = ring.orderB.storageID

            newState.balanceDeltaA_O = fee_A - protocolFee_A
            newState.balanceDeltaB_O = fee_B - protocolFee_B

            newState.balanceDeltaA_P = protocolFee_A
            newState.balanceDeltaB_P = protocolFee_B

        elif txInput.txType == "Transfer":

            storageData = self.getData(txInput.fromAccountID, txInput.tokenID, txInput.storageID)

            transferAmount = roundToFloatValue(int(txInput.amount), Float24Encoding)
            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            newState.signatureA = txInput.signature
            newState.signatureB = txInput.dualSignature

            newState.TXV_ACCOUNT_A_ADDRESS = txInput.fromAccountID
            accountA = self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS)

            newState.TXV_BALANCE_A_S_ADDRESS = txInput.tokenID
            newState.TXV_BALANCE_A_S_BALANCE = -transferAmount

            newState.TXV_BALANCE_B_S_ADDRESS = txInput.feeTokenID
            newState.TXV_BALANCE_A_B_BALANCE = -feeValue

            newState.TXV_ACCOUNT_B_ADDRESS = txInput.toAccountID
            accountB = self.getAccount(newState.TXV_ACCOUNT_B_ADDRESS)
            newState.TXV_ACCOUNT_B_OWNER = txInput.to

            newState.TXV_BALANCE_A_S_ADDRESS = txInput.tokenID
            newState.TXV_BALANCE_B_B_BALANCE = transferAmount

            newState.TXV_STORAGE_A_ADDRESS = txInput.storageID
            newState.TXV_STORAGE_A_DATA = 1
            newState.TXV_STORAGE_A_STORAGEID = txInput.storageID

            if txInput.type != 0:
                context.numConditionalTransactions = context.numConditionalTransactions + 1

            newState.balanceDeltaA_O = feeValue

            # For tests (used to set the DA data)
            txInput.toNewAccount = True if accountB.owner == str(0) else False

        elif txInput.txType == "Withdraw":

            ## calculate how much can be withdrawn
            account = self.getAccount(txInput.accountID)
            if int(txInput.type) == 2:
                # Full balance with intrest
                balanceLeaf = account.getBalanceLeaf(txInput.tokenID)
                txInput.amount = str(balanceLeaf.balance)
            elif int(txInput.type) == 3:
                txInput.amount = str(0)


            # Protocol fee withdrawals are handled a bit differently
            # as the balance needs to be withdrawn from the already opened protocol pool account
            isProtocolfeeWithdrawal = int(txInput.accountID) == 0

            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            newState.signatureA = txInput.signature

            newState.TXV_ACCOUNT_A_ADDRESS = 1 if isProtocolfeeWithdrawal else txInput.accountID
            accountA = self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS)

            newState.TXV_BALANCE_A_S_ADDRESS = txInput.tokenID
            newState.TXV_BALANCE_A_S_BALANCE = 0 if isProtocolfeeWithdrawal else -int(txInput.amount)

            newState.TXV_BALANCE_B_S_ADDRESS = txInput.feeTokenID
            newState.TXV_BALANCE_A_B_BALANCE = -feeValue

            newState.TXV_STORAGE_A_ADDRESS = txInput.storageID
            if int(txInput.type) == 0 or int(txInput.type) == 1:
                newState.TXV_STORAGE_A_DATA = 1
                newState.TXV_STORAGE_A_STORAGEID = txInput.storageID
            if not isProtocolfeeWithdrawal and int(txInput.type) == 2:
                newState.TXV_BALANCE_A_S_WEIGHT = 0

            newState.balanceDeltaA_O = feeValue

            newState.balanceDeltaB_P = -int(txInput.amount) if isProtocolfeeWithdrawal else 0

            context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "Deposit":

            newState.TXV_ACCOUNT_A_ADDRESS = txInput.accountID
            newState.TXV_ACCOUNT_A_OWNER = txInput.owner

            newState.TXV_BALANCE_A_S_ADDRESS = txInput.tokenID
            newState.TXV_BALANCE_A_S_BALANCE = txInput.amount

            context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "AccountUpdate":

            feeValue = roundToFloatValue(int(txInput.fee), Float16Encoding)

            newState.TXV_ACCOUNT_A_ADDRESS = txInput.accountID
            accountA = self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS)

            newState.TXV_ACCOUNT_A_OWNER = txInput.owner
            newState.TXV_ACCOUNT_A_PUBKEY_X = txInput.publicKeyX
            newState.TXV_ACCOUNT_A_PUBKEY_Y = txInput.publicKeyY
            newState.TXV_ACCOUNT_A_NONCE = 1

            newState.TXV_BALANCE_A_S_ADDRESS = txInput.feeTokenID
            newState.TXV_BALANCE_A_S_BALANCE = -feeValue

            newState.balanceDeltaB_O = feeValue

            newState.signatureA = txInput.signature

            if txInput.type != 0:
                context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "AmmUpdate":

            # Cache the balance for tests
            account = self.getAccount(txInput.accountID)
            balanceLeaf = account.getBalanceLeaf(txInput.tokenID)
            txInput.balance = str(balanceLeaf.balance)

            newState.TXV_ACCOUNT_A_ADDRESS = txInput.accountID
            newState.TXV_BALANCE_A_S_ADDRESS = txInput.tokenID

            newState.TXV_ACCOUNT_A_NONCE = 1
            newState.TXV_ACCOUNT_A_FEEBIPSAMM = txInput.feeBips
            newState.TXV_BALANCE_A_S_WEIGHT = txInput.tokenWeight

            context.numConditionalTransactions = context.numConditionalTransactions + 1

        elif txInput.txType == "SignatureVerification":

            newState.TXV_ACCOUNT_A_ADDRESS = txInput.accountID
            newState.signatureA = txInput.signature


        # Tokens default values
        newState.TXV_BALANCE_A_S_ADDRESS = setValue(newState.TXV_BALANCE_A_S_ADDRESS, 0)
        newState.TXV_BALANCE_B_S_ADDRESS = setValue(newState.TXV_BALANCE_B_S_ADDRESS, 0)

        # A default values
        newState.TXV_ACCOUNT_A_ADDRESS = setValue(newState.TXV_ACCOUNT_A_ADDRESS, 1)
        accountA = self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS)
        newState.TXV_ACCOUNT_A_OWNER = setValue(newState.TXV_ACCOUNT_A_OWNER, accountA.owner)
        newState.TXV_ACCOUNT_A_PUBKEY_X = setValue(newState.TXV_ACCOUNT_A_PUBKEY_X, accountA.publicKeyX)
        newState.TXV_ACCOUNT_A_PUBKEY_Y = setValue(newState.TXV_ACCOUNT_A_PUBKEY_Y, accountA.publicKeyY)
        newState.TXV_ACCOUNT_A_NONCE = setValue(newState.TXV_ACCOUNT_A_NONCE, 0)
        newState.TXV_ACCOUNT_A_FEEBIPSAMM = setValue(newState.TXV_ACCOUNT_A_FEEBIPSAMM, accountA.feeBipsAMM)

        balanceLeafA_S = accountA.getBalanceLeaf(newState.TXV_BALANCE_A_S_ADDRESS)
        newState.TXV_BALANCE_A_S_BALANCE = setValue(newState.TXV_BALANCE_A_S_BALANCE, 0)
        newState.TXV_BALANCE_A_S_WEIGHT = setValue(newState.TXV_BALANCE_A_S_WEIGHT, balanceLeafA_S.weightAMM)

        newState.TXV_BALANCE_A_B_BALANCE = setValue(newState.TXV_BALANCE_A_B_BALANCE, 0)

        newState.TXV_STORAGE_A_ADDRESS = setValue(newState.TXV_STORAGE_A_ADDRESS, 0)
        storageA = balanceLeafA_S.getStorage(newState.TXV_STORAGE_A_ADDRESS)
        newState.TXV_STORAGE_A_DATA = setValue(newState.TXV_STORAGE_A_DATA, storageA.data)
        newState.TXV_STORAGE_A_STORAGEID = setValue(newState.TXV_STORAGE_A_STORAGEID, storageA.storageID)

        # Operator default values
        newState.balanceDeltaA_O = setValue(newState.balanceDeltaA_O, 0)
        newState.balanceDeltaB_O = setValue(newState.balanceDeltaB_O, 0)

        # Protocol fees default values
        newState.balanceDeltaA_P = setValue(newState.balanceDeltaA_P, 0)
        newState.balanceDeltaB_P = setValue(newState.balanceDeltaB_P, 0)


        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        # Update A
        accountA = self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS))
        proof = self._accountsTree.createProof(newState.TXV_ACCOUNT_A_ADDRESS)

        (balanceUpdateS_A, storageUpdate_A) = accountA.updateBalanceAndStorage(
            newState.TXV_BALANCE_A_S_ADDRESS,
            newState.TXV_STORAGE_A_STORAGEID,
            newState.TXV_STORAGE_A_DATA,
            newState.TXV_BALANCE_A_S_BALANCE,
            newState.TXV_BALANCE_A_S_WEIGHT
        )
        balanceUpdateB_A = accountA.updateBalance(
            newState.TXV_BALANCE_B_S_ADDRESS,
            newState.TXV_BALANCE_A_B_BALANCE
        )

        accountA.owner = newState.TXV_ACCOUNT_A_OWNER
        accountA.publicKeyX = newState.TXV_ACCOUNT_A_PUBKEY_X
        accountA.publicKeyY = newState.TXV_ACCOUNT_A_PUBKEY_Y
        accountA.nonce = accountA.nonce + newState.TXV_ACCOUNT_A_NONCE
        accountA.feeBipsAMM = newState.TXV_ACCOUNT_A_FEEBIPSAMM

        self.updateAccountTree(newState.TXV_ACCOUNT_A_ADDRESS)
        accountAfter = copyAccountInfo(self.getAccount(newState.TXV_ACCOUNT_A_ADDRESS))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(newState.TXV_ACCOUNT_A_ADDRESS, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # B default values
        newState.TXV_ACCOUNT_B_ADDRESS = setValue(newState.TXV_ACCOUNT_B_ADDRESS, 1)
        accountB = self.getAccount(newState.TXV_ACCOUNT_B_ADDRESS)
        newState.TXV_ACCOUNT_B_OWNER = setValue(newState.TXV_ACCOUNT_B_OWNER, accountB.owner)
        newState.TXV_ACCOUNT_B_PUBKEY_X = setValue(newState.TXV_ACCOUNT_B_PUBKEY_X, accountB.publicKeyX)
        newState.TXV_ACCOUNT_B_PUBKEY_Y = setValue(newState.TXV_ACCOUNT_B_PUBKEY_Y, accountB.publicKeyY)
        newState.TXV_ACCOUNT_B_NONCE = setValue(newState.TXV_ACCOUNT_B_NONCE, 0)

        balanceLeafB_S = accountB.getBalanceLeaf(newState.TXV_BALANCE_B_S_ADDRESS)
        newState.TXV_BALANCE_B_S_BALANCE = setValue(newState.TXV_BALANCE_B_S_BALANCE, 0)

        newState.TXV_BALANCE_B_B_BALANCE = setValue(newState.TXV_BALANCE_B_B_BALANCE, 0)

        newState.TXV_STORAGE_B_ADDRESS = setValue(newState.TXV_STORAGE_B_ADDRESS, 0)
        storageB = balanceLeafB_S.getStorage(newState.TXV_STORAGE_B_ADDRESS)
        newState.TXV_STORAGE_B_DATA = setValue(newState.TXV_STORAGE_B_DATA, storageB.data)
        newState.TXV_STORAGE_B_STORAGEID = setValue(newState.TXV_STORAGE_B_STORAGEID, storageB.storageID)

        # Update B
        accountB = self.getAccount(newState.TXV_ACCOUNT_B_ADDRESS)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(newState.TXV_ACCOUNT_B_ADDRESS))
        proof = self._accountsTree.createProof(newState.TXV_ACCOUNT_B_ADDRESS)

        (balanceUpdateS_B, storageUpdate_B) = accountB.updateBalanceAndStorage(
            newState.TXV_BALANCE_B_S_ADDRESS,
            newState.TXV_STORAGE_B_STORAGEID,
            newState.TXV_STORAGE_B_DATA,
            newState.TXV_BALANCE_B_S_BALANCE
        )
        balanceUpdateB_B = accountB.updateBalance(
            newState.TXV_BALANCE_A_S_ADDRESS,
            newState.TXV_BALANCE_B_B_BALANCE
        )

        accountB.owner = newState.TXV_ACCOUNT_B_OWNER
        accountB.publicKeyX = newState.TXV_ACCOUNT_B_PUBKEY_X
        accountB.publicKeyY = newState.TXV_ACCOUNT_B_PUBKEY_Y
        accountB.nonce = accountB.nonce + newState.TXV_ACCOUNT_B_NONCE

        self.updateAccountTree(newState.TXV_ACCOUNT_B_ADDRESS)
        accountAfter = copyAccountInfo(self.getAccount(newState.TXV_ACCOUNT_B_ADDRESS))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(newState.TXV_ACCOUNT_B_ADDRESS, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update balances Operator
        accountO = self.getAccount(context.operatorAccountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(context.operatorAccountID))
        proof = self._accountsTree.createProof(context.operatorAccountID)

        balanceUpdateB_O = accountO.updateBalance(
            newState.TXV_BALANCE_A_S_ADDRESS,
            newState.balanceDeltaB_O
        )
        balanceUpdateA_O = accountO.updateBalance(
            newState.TXV_BALANCE_B_S_ADDRESS,
            newState.balanceDeltaA_O
        )

        self.updateAccountTree(context.operatorAccountID)
        accountAfter = copyAccountInfo(self.getAccount(context.operatorAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_O = AccountUpdateData(context.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Protocol fee payment
        balanceUpdateB_P = self.getAccount(0).updateBalance(newState.TXV_BALANCE_A_S_ADDRESS, newState.balanceDeltaB_P)
        balanceUpdateA_P = self.getAccount(0).updateBalance(newState.TXV_BALANCE_B_S_ADDRESS, newState.balanceDeltaA_P)
        ###

        witness = Witness(newState.signatureA, newState.signatureB,
                          accountsMerkleRoot,
                          storageUpdate_A, storageUpdate_B,
                          balanceUpdateS_A, balanceUpdateB_A, accountUpdate_A,
                          balanceUpdateS_B, balanceUpdateB_B, accountUpdate_B,
                          balanceUpdateA_O, balanceUpdateB_O, accountUpdate_O,
                          balanceUpdateA_P, balanceUpdateB_P)

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

