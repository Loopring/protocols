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


class Context(object):
    def __init__(self, operator, timestamp):
        self.operator = int(operator)
        self.timestamp = int(timestamp)

class Signature(object):
    def __init__(self, sig):
        self.Rx = str(sig.R.x)
        self.Ry = str(sig.R.y)
        self.s = str(sig.s)

class Account(object):
    def __init__(self, secretKey, publicKey, walletID, token, balance):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletID = walletID
        self.token = token
        self.balance = balance
        self.nonce = 0

    def hash(self):
        #return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.walletID), int(self.token), int(self.balance)], 1)
        return mimc_hash([int(self.publicKeyX), int(self.publicKeyY), int(self.token), int(self.balance)], 1)

    def fromJSON(self, jAccount):
        self.secretKey = jAccount["secretKey"]
        self.publicKeyX = jAccount["publicKeyX"]
        self.publicKeyY = jAccount["publicKeyY"]
        self.walletID = int(jAccount["walletID"])
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

class BurnRateLeaf(object):
    def __init__(self, burnRate):
        self.burnRate = burnRate

    def hash(self):
        return self.burnRate

    def fromJSON(self, jBurnRateLeaf):
        self.burnRate = int(jBurnRateLeaf["burnRate"])

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

class BurnRateCheckData(object):
    def __init__(self, burnRateData, proof):
        self.burnRateData = burnRateData
        self.proof = [str(_) for _ in proof]

class Order(object):
    def __init__(self, publicKey, walletPublicKey, minerPublicKeyF, minerPublicKeyS,
                 walletID, orderID,
                 accountS, accountB, accountF, walletF, minerF, minerS,
                 amountS, amountB, amountF,
                 tokenS, tokenB, tokenF,
                 allOrNone, validSince, validUntil,
                 walletSplitPercentage, waiveFeePercentage):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)
        self.minerPublicKeyFX = str(minerPublicKeyF.x)
        self.minerPublicKeyFY = str(minerPublicKeyF.y)
        self.minerPublicKeySX = str(minerPublicKeyS.x)
        self.minerPublicKeySY = str(minerPublicKeyS.y)
        self.walletID = walletID
        self.orderID = orderID
        self.accountS = accountS
        self.accountB = accountB
        self.accountF = accountF
        self.amountS = amountS
        self.amountB = amountB
        self.amountF = amountF

        self.allOrNone = bool(allOrNone)
        self.validSince = validSince
        self.validUntil = validUntil
        self.walletSplitPercentage = walletSplitPercentage
        self.waiveFeePercentage = waiveFeePercentage

        self.walletF = walletF
        self.minerF = minerF
        self.minerS = minerS

        self.tokenS = tokenS
        self.tokenB = tokenB
        self.tokenF = tokenF

    def message(self):
        msg_parts = [
                        FQ(int(self.walletID), 1<<16), FQ(int(self.orderID), 1<<4),
                        FQ(int(self.accountS), 1<<24), FQ(int(self.accountB), 1<<24), FQ(int(self.accountF), 1<<24),
                        FQ(self.amountS, 1<<96), FQ(self.amountB, 1<<96), FQ(self.amountF, 1<<96)
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
        if self.allOrNone and fillAmountS != self.amountS:
            valid = False
        else:
            valid = True
        return valid


class Ring(object):
    def __init__(self, orderA, orderB, publicKey, miner, fee, nonce):
        self.orderA = orderA
        self.orderB = orderB
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.miner = miner
        self.fee = fee
        self.nonce = nonce

    def message(self):
        msg_parts = [
                        FQ(int(self.orderA.hash), 1<<254), FQ(int(self.orderB.hash), 1<<254),
                        FQ(int(self.orderA.waiveFeePercentage), 1<<7), FQ(int(self.orderB.waiveFeePercentage), 1<<7),
                        FQ(int(self.orderA.minerF), 1<<24), FQ(int(self.orderB.minerF), 1<<24),
                        FQ(int(self.orderA.minerS), 1<<24),
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
    def __init__(self, tradingHistoryMerkleRoot, accountsMerkleRoot, ring,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 accountUpdateS_A, accountUpdateB_A, accountUpdateF_A, accountUpdateF_WA, accountUpdateF_MA, accountUpdateF_BA,
                 accountUpdateS_B, accountUpdateB_B, accountUpdateF_B, accountUpdateF_WB, accountUpdateF_MB, accountUpdateF_BB,
                 accountUpdateS_M,
                 accountUpdate_M,
                 burnRateCheckF_A, walletFee_A, matchingFee_A, burnFee_A,
                 burnRateCheckF_B, walletFee_B, matchingFee_B, burnFee_B):
        self.tradingHistoryMerkleRoot = str(tradingHistoryMerkleRoot)
        self.accountsMerkleRoot = str(accountsMerkleRoot)
        self.ring = ring

        self.tradeHistoryUpdate_A = tradeHistoryUpdate_A
        self.tradeHistoryUpdate_B = tradeHistoryUpdate_B

        self.accountUpdateS_A = accountUpdateS_A
        self.accountUpdateB_A = accountUpdateB_A
        self.accountUpdateF_A = accountUpdateF_A
        self.accountUpdateF_WA = accountUpdateF_WA
        self.accountUpdateF_MA = accountUpdateF_MA
        self.accountUpdateF_BA = accountUpdateF_BA

        self.accountUpdateS_B = accountUpdateS_B
        self.accountUpdateB_B = accountUpdateB_B
        self.accountUpdateF_B = accountUpdateF_B
        self.accountUpdateF_WB = accountUpdateF_WB
        self.accountUpdateF_MB = accountUpdateF_MB
        self.accountUpdateF_BB = accountUpdateF_BB

        self.accountUpdateS_M = accountUpdateS_M

        self.accountUpdate_M = accountUpdate_M

        self.burnRateCheckF_A = burnRateCheckF_A
        self.walletFee_A = walletFee_A
        self.matchingFee_A = matchingFee_A
        self.burnFee_A = burnFee_A

        self.burnRateCheckF_B = burnRateCheckF_B
        self.walletFee_B = walletFee_B
        self.matchingFee_B = matchingFee_B
        self.burnFee_B = burnFee_B


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
        self.signature = Signature(signedMessage.sig)


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
        self.signature = Signature(signedMessage.sig)


class State(object):
    def __init__(self):
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf(0, 0).hash())
        self._tradeHistoryLeafs = {}
        #print("Empty trading tree: " + str(self._tradingHistoryTree._root))
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(Account(0, Point(0, 0), 0, 0, 0).hash())
        self._accounts = {}
        self._numAccounts = 1024
        #print("Empty accounts tree: " + str(self._accountsTree._root))
        # Tokens
        self._tokensTree = MerkleTree(1 << 16)
        self._tokens = []

    def load(self, filename):
        with open(filename) as f:
            data = json.load(f)
            tradeHistoryLeafsDict = data["trading_history_values"]
            for key, val in tradeHistoryLeafsDict.items():
                self._tradeHistoryLeafs[key] = TradeHistoryLeaf(val["filled"], val["cancelled"])
            self._tradingHistoryTree._root = data["trading_history_root"]
            self._tradingHistoryTree._db.kv = data["trading_history_tree"]
            accountLeafsDict = data["accounts_values"]
            for key, val in accountLeafsDict.items():
                account = Account(0, Point(0, 0), 0, 0, 0)
                account.fromJSON(val)
                self._accounts[key] = account
            self._numAccounts = data["num_accounts"]
            self._accountsTree._root = data["accounts_root"]
            self._accountsTree._db.kv = data["accounts_tree"]
            for jBurnRateLeaf in data["tokens_values"]:
                token = BurnRateLeaf(0)
                token.fromJSON(jBurnRateLeaf)
                self._tokens.append(token)
                self._tokensTree.append(token.hash())

    def save(self, filename):
        with open(filename, "w") as file:
            file.write(json.dumps(
                {
                    "trading_history_values": self._tradeHistoryLeafs,
                    "trading_history_root": self._tradingHistoryTree._root,
                    "trading_history_tree": self._tradingHistoryTree._db.kv,
                    "accounts_values": self._accounts,
                    "num_accounts": self._numAccounts,
                    "accounts_root": self._accountsTree._root,
                    "accounts_tree": self._accountsTree._db.kv,
                    "tokens_values": self._tokens,
                }, default=lambda o: o.__dict__, sort_keys=True, indent=4))

    def getTradeHistory(self, address):
        # Make sure the leaf exist in our map
        if not(str(address) in self._tradeHistoryLeafs):
            return TradeHistoryLeaf(0, 0)
        else:
            return self._tradeHistoryLeafs[str(address)]

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
        if not(str(address) in self._accounts):
            self._accounts[str(address)] = Account(0, Point(0, 0), 0, 0, 0)

        accountBefore = copy.deepcopy(self._accounts[str(address)])
        #print("accountBefore: " + str(accountBefore.balance))
        self._accounts[str(address)].balance += amount
        accountAfter = copy.deepcopy(self._accounts[str(address)])
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

        burnRateData = copy.deepcopy(self._tokens[address])
        proof = self._tokensTree.proof(address).path

        return BurnRateCheckData(burnRateData, proof)

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

    def getTradeHistoryAddress(self, order):
        return (order.accountS << 4) + order.orderID

    def getMaxFillAmounts(self, order):
        tradeHistory = self.getTradeHistory(self.getTradeHistoryAddress(order))
        order.filledBefore = int(tradeHistory.filled)
        order.cancelled = int(tradeHistory.cancelled)
        order.balanceS = int(self.getAccount(order.accountS).balance)
        order.balanceB = int(self.getAccount(order.accountB).balance)
        order.balanceF = int(self.getAccount(order.accountF).balance)

        balanceS = int(self.getAccount(order.accountS).balance)
        remainingS = order.amountS - order.filledBefore
        fillAmountS = balanceS if (balanceS < remainingS) else remainingS
        fillAmountB = (fillAmountS * order.amountB) // order.amountS
        return (fillAmountS, fillAmountB)

    def settleRing(self, context, ring):
        (fillAmountS_A, fillAmountB_A) = self.getMaxFillAmounts(ring.orderA)
        (fillAmountS_B, fillAmountB_B) = self.getMaxFillAmounts(ring.orderB)

        if fillAmountB_A < fillAmountS_B:
            fillAmountB_B = fillAmountS_A
            fillAmountS_B = (fillAmountB_B * ring.orderB.amountS) // ring.orderB.amountB
        else:
            fillAmountB_A = fillAmountS_B
            fillAmountS_A = (fillAmountB_A * ring.orderA.amountS) // ring.orderA.amountB

        margin = fillAmountS_A - fillAmountB_B

        ring.valid = True
        if fillAmountS_A < fillAmountB_B:
            ring.valid = False

        ring.orderA.checkValid(context)
        ring.orderB.checkValid(context)
        fillsValidA = ring.orderA.checkFills(fillAmountS_A, fillAmountB_A)
        fillsValidB = ring.orderB.checkFills(fillAmountS_B, fillAmountB_B)
        ring.valid = ring.valid and ring.orderA.valid and ring.orderB.valid and fillsValidA and fillsValidB

        if ring.valid == False:
            fillAmountS_A = 0
            fillAmountB_A = 0
            fillAmountS_B = 0
            fillAmountB_B = 0
            margin = 0

        fillAmountF_A = (ring.orderA.amountF * fillAmountS_A) // ring.orderA.amountS
        fillAmountF_B = (ring.orderB.amountF * fillAmountS_B) // ring.orderB.amountS

        ring.fillS_A = fillAmountS_A
        ring.fillB_A = fillAmountB_A
        ring.fillF_A = fillAmountF_A

        ring.fillS_B = fillAmountS_B
        ring.fillB_B = fillAmountB_B
        ring.fillF_B = fillAmountF_B

        ring.margin = margin

        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountF_A: " + str(fillAmountF_A))

        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("fillAmountF_B: " + str(fillAmountF_B))

        print("margin: " + str(margin))

        # Copy the initial merkle root
        tradingHistoryMerkleRoot = self._tradingHistoryTree._root
        accountsMerkleRoot = self._accountsTree._root

        # Update filled amounts
        tradeHistoryUpdate_A = self.updateTradeHistory(self.getTradeHistoryAddress(ring.orderA), ring.fillS_A)
        tradeHistoryUpdate_B = self.updateTradeHistory(self.getTradeHistoryAddress(ring.orderB), ring.fillS_B)

        # Check burn rates
        burnRateCheckF_A = self.checkBurnRate(ring.orderA.tokenF)
        burnRateCheckF_B = self.checkBurnRate(ring.orderB.tokenF)

        (walletFee_A, matchingFee_A, burnFee_A) = self.calculateFees(
            ring.fillF_A,
            burnRateCheckF_A.burnRateData.burnRate,
            ring.orderA.walletSplitPercentage,
            ring.orderA.waiveFeePercentage
        )

        (walletFee_B, matchingFee_B, burnFee_B) = self.calculateFees(
            ring.fillF_B,
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
        accountUpdateS_A = self.updateBalance(ring.orderA.accountS, -ring.fillS_A)
        accountUpdateB_A = self.updateBalance(ring.orderA.accountB, ring.fillB_A)
        accountUpdateF_A = self.updateBalance(ring.orderA.accountF, -(walletFee_A + matchingFee_A + burnFee_A))
        accountUpdateF_WA = self.updateBalance(ring.orderA.walletF, walletFee_A)
        accountUpdateF_MA = self.updateBalance(ring.orderA.minerF, matchingFee_A)
        accountUpdateF_BA = self.updateBalance(ring.orderA.walletF, burnFee_A)

        # Update balances B
        accountUpdateS_B = self.updateBalance(ring.orderB.accountS, -ring.fillS_B)
        accountUpdateB_B = self.updateBalance(ring.orderB.accountB, ring.fillB_B)
        accountUpdateF_B = self.updateBalance(ring.orderB.accountF, -(walletFee_B + matchingFee_B + burnFee_B))
        accountUpdateF_WB = self.updateBalance(ring.orderB.walletF, walletFee_B)
        accountUpdateF_MB = self.updateBalance(ring.orderB.minerF, matchingFee_B)
        accountUpdateF_BB = self.updateBalance(ring.orderB.walletF, burnFee_B)

        # Margin
        accountUpdateS_M = self.updateBalance(ring.orderA.minerS, ring.margin)

        # Operator payment
        accountUpdate_M = self.updateBalance(ring.miner, -ring.fee)

        return RingSettlement(tradingHistoryMerkleRoot, accountsMerkleRoot, ring,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              accountUpdateS_A, accountUpdateB_A, accountUpdateF_A, accountUpdateF_WA, accountUpdateF_MA, accountUpdateF_BA,
                              accountUpdateS_B, accountUpdateB_B, accountUpdateF_B, accountUpdateF_WB, accountUpdateF_MB, accountUpdateF_BB,
                              accountUpdateS_M,
                              accountUpdate_M,
                              burnRateCheckF_A, walletFee_A, matchingFee_A, burnFee_A,
                              burnRateCheckF_B, walletFee_B, matchingFee_B, burnFee_B)

    def deposit(self, address, account):
        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        proof = self._accountsTree.createProof(address)

        accountBefore = copy.deepcopy(Account(0, Point(0, 0), 0, 0, 0))
        self._accountsTree.update(address, account.hash())
        accountAfter = copy.deepcopy(account)

        self._accounts[str(self._numAccounts)] = account
        self._numAccounts = self._numAccounts + 1

        proof.reverse()
        return Deposit(accountsMerkleRoot, address, AccountUpdateData(accountBefore, accountAfter, proof))

    def getAccount(self, accountID):
        # Make sure the leaf exist in our map
        if not(str(accountID) in self._accounts):
            self._accounts[str(accountID)] = Account(0, Point(0, 0), 0, 0, 0)
        return self._accounts[str(accountID)]

    def withdraw(self, address, amount):
        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root
        account = self.getAccount(address)
        accountUpdate = self.updateBalance(address, -amount)
        withdrawal = Withdrawal(accountsMerkleRoot, Point(int(account.publicKeyX), int(account.publicKeyY)), address, amount, accountUpdate)
        withdrawal.sign(FQ(int(account.secretKey)))
        return withdrawal

    def cancelOrder(self, accountAddress, orderID):
        account = self.getAccount(accountAddress)

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

    def addToken(self, burnRate):
        token = BurnRateLeaf(burnRate)
        address = self._tokensTree.append(token.hash())
        self._tokens.append(token)

        print("Tokens tree root: " + str(hex(self._tokensTree.root)))
