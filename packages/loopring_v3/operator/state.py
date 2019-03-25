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
TREE_DEPTH_TOKENS = 12

DEFAULT_ACCOUNT_PUBLICKEY_X = 2760979366321990647384327991146539505488430080750363450053902718557853404165
DEFAULT_ACCOUNT_PUBLICKEY_Y = 10771439851340068599303586501499035409517957710739943668636844002715618931667
DEFAULT_ACCOUNT_SECRETKEY   = 531595266505639429282323989096889429445309320547115026296307576144623272935


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
    return Account(DEFAULT_ACCOUNT_SECRETKEY, Point(DEFAULT_ACCOUNT_PUBLICKEY_X, DEFAULT_ACCOUNT_PUBLICKEY_Y), 0)

class Context(object):
    def __init__(self, operatorAccountID, timestamp):
        self.operatorAccountID = int(operatorAccountID)
        self.timestamp = int(timestamp)

class Signature(object):
    def __init__(self, sig):
        self.Rx = str(sig.R.x)
        self.Ry = str(sig.R.y)
        self.s = str(sig.s)

class BalanceLeaf(object):
    def __init__(self, balance = 0):
        self.balance = str(balance)
        # Trading history
        self._tradingHistoryTree = SparseMerkleTree(TREE_DEPTH_TRADING_HISTORY)
        self._tradingHistoryTree.newTree(TradeHistoryLeaf().hash())
        self._tradeHistoryLeafs = {}
        #print("Empty trading tree: " + str(self._tradingHistoryTree._root))

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


class Account(object):
    def __init__(self, secretKey, publicKey, walletID):
        self.secretKey = str(secretKey)
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletID = walletID
        self.nonce = 0
        # Balances
        self._balancesTree = SparseMerkleTree(TREE_DEPTH_TOKENS)
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
    def __init__(self, balanceUpdate, accountUpdate):
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
                 realmID, walletID, orderID, accountID, dualAuthAccountID,
                 tokenS, tokenB, tokenF,
                 amountS, amountB, amountF,
                 allOrNone, validSince, validUntil,
                 walletSplitPercentage, waiveFeePercentage):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)

        self.realmID = int(realmID)
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
                        FQ(int(self.realmID), 1<<32), FQ(int(self.orderID), 1<<16),
                        FQ(int(self.accountID), 1<<24), FQ(int(self.dualAuthAccountID), 1<<24),
                        FQ(int(self.tokenS), 1<<12), FQ(int(self.tokenB), 1<<12), FQ(int(self.tokenF), 1<<12),
                        FQ(int(self.amountS), 1<<96), FQ(int(self.amountB), 1<<96), FQ(int(self.amountF), 1<<96),
                        FQ(int(self.allOrNone), 1<<1), FQ(int(self.validSince), 1<<32), FQ(int(self.validUntil), 1<<32),
                        FQ(int(self.walletSplitPercentage), 1<<7), FQ(int(0), 1<<2)
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
    def __init__(self, orderA, orderB, minerAccountID, feeRecipientAccountID, tokenID, fee, nonce):
        self.orderA = orderA
        self.orderB = orderB
        self.minerAccountID = int(minerAccountID)
        self.feeRecipientAccountID = int(feeRecipientAccountID)
        self.tokenID = int(tokenID)
        self.fee = str(fee)
        self.nonce = int(nonce)

    def message(self):
        msg_parts = [
                        FQ(int(self.orderA.hash), 1<<254), FQ(int(self.orderB.hash), 1<<254),
                        FQ(int(self.orderA.waiveFeePercentage), 1<<7), FQ(int(self.orderB.waiveFeePercentage), 1<<7),
                        FQ(int(self.minerAccountID), 1<<24), FQ(int(self.tokenID), 1<<12), FQ(int(self.fee), 1<<96),
                        FQ(int(self.feeRecipientAccountID), 1<<24),
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
                 accountsMerkleRoot,
                 tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                 balanceUpdateS_A, balanceUpdateB_A, balanceUpdateF_A, accountUpdate_A,
                 balanceUpdateS_B, balanceUpdateB_B, balanceUpdateF_B, accountUpdate_B,
                 balanceUpdateA_W, accountUpdateA_W,
                 balanceUpdateB_W, accountUpdateB_W,
                 balanceUpdateA_F, balanceUpdateB_F, accountUpdate_F,
                 balanceUpdateM_M, balanceUpdateO_M, accountUpdate_M,
                 balanceUpdateF_O,
                 walletFee_A, matchingFee_A,
                 walletFee_B, matchingFee_B):
        self.ring = ring

        self.accountsMerkleRoot = str(accountsMerkleRoot)

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

        self.balanceUpdateA_W = balanceUpdateA_W
        self.accountUpdateA_W = accountUpdateA_W

        self.balanceUpdateB_W = balanceUpdateB_W
        self.accountUpdateB_W = accountUpdateB_W

        self.balanceUpdateA_F = balanceUpdateA_F
        self.balanceUpdateB_F = balanceUpdateB_F
        self.accountUpdate_F = accountUpdate_F

        self.balanceUpdateM_M = balanceUpdateM_M
        self.balanceUpdateO_M = balanceUpdateO_M
        self.accountUpdate_M = accountUpdate_M

        self.balanceUpdateF_O = balanceUpdateF_O

        self.walletFee_A = walletFee_A
        self.matchingFee_A = matchingFee_A

        self.walletFee_B = walletFee_B
        self.matchingFee_B = matchingFee_B


class Withdrawal(object):
    def __init__(self,
                 publicKey,
                 walletPublicKey,
                 realmID,
                 accountID, tokenID, amount,
                 walletID, dualAuthAccountID,
                 operatorAccountID, feeTokenID, fee, walletSplitPercentage,
                 nonce,
                 amountWithdrawn,
                 balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)
        self.realmID = realmID
        self.accountID = accountID
        self.tokenID = tokenID
        self.amount = str(amount)
        self.walletID = walletID
        self.dualAuthAccountID = dualAuthAccountID
        self.operatorAccountID = operatorAccountID
        self.feeTokenID = feeTokenID
        self.fee = str(fee)
        self.walletSplitPercentage = walletSplitPercentage
        self.nonce = int(nonce)
        self.amountWithdrawn = str(amountWithdrawn)

        self.balanceUpdateF_A = balanceUpdateF_A
        self.balanceUpdateW_A = balanceUpdateW_A
        self.accountUpdate_A = accountUpdate_A

        self.balanceUpdateF_W = balanceUpdateF_W
        self.accountUpdate_W = accountUpdate_W

        self.balanceUpdateF_O = balanceUpdateF_O

    def message(self):
        msg_parts = [FQ(int(self.realmID), 1<<32),
                     FQ(int(self.accountID), 1<<24), FQ(int(self.tokenID), 1<<12), FQ(int(self.amount), 1<<96),
                     FQ(int(self.dualAuthAccountID), 1<<24), FQ(int(self.feeTokenID), 1<<12), FQ(int(self.fee), 1<<96), FQ(int(self.walletSplitPercentage), 1<<7),
                     FQ(int(self.nonce), 1<<32)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k, wallet_k):
        msg = self.message()
        # owner
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)
        # wallet
        signedMessage = PureEdDSA.sign(msg, wallet_k)
        self.walletSignature = Signature(signedMessage.sig)


class Cancellation(object):
    def __init__(self,
                 publicKey,
                 walletPublicKey,
                 realmID,
                 accountID, orderTokenID, orderID, walletID, dualAuthorAccountID,
                 operatorAccountID, feeTokenID, fee, walletSplitPercentage,
                 nonce,
                 tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                 balanceUpdateF_W, accountUpdate_W,
                 balanceUpdateF_O):
        self.publicKeyX = str(publicKey.x)
        self.publicKeyY = str(publicKey.y)
        self.walletPublicKeyX = str(walletPublicKey.x)
        self.walletPublicKeyY = str(walletPublicKey.y)
        self.realmID = realmID
        self.accountID = accountID
        self.orderTokenID = orderTokenID
        self.orderID = orderID
        self.walletID = walletID
        self.dualAuthorAccountID = dualAuthorAccountID
        self.operatorAccountID = operatorAccountID
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
        msg_parts = [FQ(int(self.realmID), 1<<32),
                     FQ(int(self.accountID), 1<<24), FQ(int(self.orderTokenID), 1<<12), FQ(int(self.orderID), 1<<16), FQ(int(self.dualAuthorAccountID), 1<<24),
                     FQ(int(self.feeTokenID), 1<<12), FQ(int(self.fee), 1<<96), FQ(int(self.walletSplitPercentage), 1<<7),
                     FQ(int(self.nonce), 1<<32), FQ(int(0), 1<<2)]
        return PureEdDSA.to_bits(*msg_parts)

    def sign(self, k, wallet_k):
        msg = self.message()
        # owner
        signedMessage = PureEdDSA.sign(msg, k)
        self.signature = Signature(signedMessage.sig)
        # wallet
        signedMessage = PureEdDSA.sign(msg, wallet_k)
        self.walletSignature = Signature(signedMessage.sig)


class State(object):
    def __init__(self, realmID):
        self.realmID = int(realmID)
        # Accounts
        self._accountsTree = SparseMerkleTree(TREE_DEPTH_ACCOUNTS)
        self._accountsTree.newTree(getDefaultAccount().hash())
        self._accounts = {}
        self._accounts[str(0)] = getDefaultAccount()
        print("Empty accounts tree: " + str(hex(self._accountsTree._root)))

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

    def calculateFees(self, fee, walletSplitPercentage, waiveFeePercentage):
        walletFee = (fee * walletSplitPercentage) // 100
        matchingFee = fee - walletFee

        matchingFeeAfterWaiving = (matchingFee * waiveFeePercentage) // 100

        return (walletFee, matchingFeeAfterWaiving)

    def getMaxFillAmounts(self, order):
        account = self.getAccount(order.accountID)
        tradeHistory = account._balancesLeafs[str(order.tokenS)].getTradeHistory(order.orderID)
        order.filledBefore = str(tradeHistory.filled)
        order.cancelled = int(tradeHistory.cancelled)
        order.nonce = int(account.nonce)
        order.balanceS = str(account.getBalance(order.tokenS))
        order.balanceB = str(account.getBalance(order.tokenB))
        order.balanceF = str(account.getBalance(order.tokenF))

        balanceS = int(account.getBalance(order.tokenS))
        balanceF = int(account.getBalance(order.tokenF))
        remainingS = int(order.amountS) - int(order.filledBefore)
        if order.cancelled == 1:
            remainingS = 0
        fillAmountS = balanceS if (balanceS < remainingS) else remainingS

        # Check how much fee needs to be paid. We limit fillAmountS to how much
        # fee the order owner can pay.
        fillAmountF = int(order.amountF) * fillAmountS // int(order.amountS)

        if order.tokenF == order.tokenS and balanceS < fillAmountS + fillAmountF:
            # Equally divide the available tokens between fillAmountS and fillAmountF
            fillAmountS = balanceS * int(order.amountS) // (int(order.amountS) + int(order.amountF))

        if order.tokenF != order.tokenS and balanceF < fillAmountF:
            # Scale down fillAmountS so the available fillAmountF is sufficient
            fillAmountS = balanceF * int(order.amountS) // int(order.amountF)

        if order.tokenF == order.tokenB and int(order.amountF) <= int(order.amountB):
            # No rebalancing (because of insufficient balanceF) is ever necessary when amountF <= amountB
            fillAmountS = balanceS if (balanceS < remainingS) else remainingS

        fillAmountB = (fillAmountS * int(order.amountB)) // int(order.amountS)
        return (fillAmountS, fillAmountB)

    def settleRing(self, context, ring):
        #print("State update ring: ")

        (fillAmountS_A, fillAmountB_A) = self.getMaxFillAmounts(ring.orderA)
        (fillAmountS_B, fillAmountB_B) = self.getMaxFillAmounts(ring.orderB)

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

        fillAmountF_A = (int(ring.orderA.amountF) * fillAmountS_A) // int(ring.orderA.amountS)
        fillAmountF_B = (int(ring.orderB.amountF) * fillAmountS_B) // int(ring.orderB.amountS)

        margin = fillAmountS_A - fillAmountB_B

        # matchable
        ring.valid = True
        if fillAmountS_A < fillAmountB_B:
            ring.valid = False

        # self-trading
        totalFee = fillAmountF_A + fillAmountF_B
        if ring.orderA.accountID == ring.orderB.accountID and ring.orderA.tokenF == ring.orderB.tokenF and int(ring.orderA.balanceF) < totalFee:
            ring.valid = False

        ring.orderA.checkValid(context, fillAmountS_A, fillAmountB_A)
        ring.orderB.checkValid(context, fillAmountS_B, fillAmountB_B)
        ring.valid = ring.valid and ring.orderA.valid and ring.orderB.valid

        #print("ring.orderA.valid " + str(ring.orderA.valid))
        #print("ring.orderB.valid " + str(ring.orderB.valid))

        if ring.valid == False:
            #print("ring.valid false: ")
            fillAmountS_A = 0
            fillAmountB_A = 0
            fillAmountF_A = 0
            fillAmountS_B = 0
            fillAmountB_B = 0
            fillAmountF_B = 0
            margin = 0

        ring.fillS_A = str(fillAmountS_A)
        ring.fillB_A = str(fillAmountB_A)
        ring.fillF_A = str(fillAmountF_A)

        ring.fillS_B = str(fillAmountS_B)
        ring.fillB_B = str(fillAmountB_B)
        ring.fillF_B = str(fillAmountF_B)

        ring.margin = str(margin)

        '''
        print("fillAmountS_A: " + str(fillAmountS_A))
        print("fillAmountB_A: " + str(fillAmountB_A))
        print("fillAmountF_A: " + str(fillAmountF_A))
        print("fillAmountS_B: " + str(fillAmountS_B))
        print("fillAmountB_B: " + str(fillAmountB_B))
        print("fillAmountF_B: " + str(fillAmountF_B))
        print("margin: " + str(margin))
        '''

        # Copy the initial merkle root
        accountsMerkleRoot = self._accountsTree._root

        (walletFee_A, matchingFee_A) = self.calculateFees(
            int(ring.fillF_A),
            ring.orderA.walletSplitPercentage,
            ring.orderA.waiveFeePercentage
        )

        (walletFee_B, matchingFee_B) = self.calculateFees(
            int(ring.fillF_B),
            ring.orderB.walletSplitPercentage,
            ring.orderB.waiveFeePercentage
        )

        # Update balances A
        accountA = self.getAccount(ring.orderA.accountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        proof = self._accountsTree.createProof(ring.orderA.accountID)

        (balanceUpdateS_A, tradeHistoryUpdate_A) = accountA.updateBalanceAndTradeHistory(ring.orderA.tokenS, ring.orderA.orderID, -int(ring.fillS_A))
        balanceUpdateB_A = accountA.updateBalance(ring.orderA.tokenB, int(ring.fillB_A))
        balanceUpdateF_A = accountA.updateBalance(ring.orderA.tokenF, -(walletFee_A + matchingFee_A))

        self.updateAccountTree(ring.orderA.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderA.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(ring.orderA.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update balances B
        accountB = self.getAccount(ring.orderB.accountID)

        ring.orderB.balanceS = str(accountB.getBalance(ring.orderB.tokenS))
        ring.orderB.balanceB = str(accountB.getBalance(ring.orderB.tokenB))
        ring.orderB.balanceF = str(accountB.getBalance(ring.orderB.tokenF))

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        proof = self._accountsTree.createProof(ring.orderB.accountID)

        (balanceUpdateS_B, tradeHistoryUpdate_B) = accountB.updateBalanceAndTradeHistory(ring.orderB.tokenS, ring.orderB.orderID, -int(ring.fillS_B))
        balanceUpdateB_B = accountB.updateBalance(ring.orderB.tokenB, int(ring.fillB_B))
        balanceUpdateF_B = accountB.updateBalance(ring.orderB.tokenF, -(walletFee_B + matchingFee_B))

        self.updateAccountTree(ring.orderB.accountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_B = AccountUpdateData(ring.orderB.accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Update wallet A
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderA.dualAuthAccountID))
        proof = self._accountsTree.createProof(ring.orderA.dualAuthAccountID)

        balanceUpdateA_W = self.getAccount(ring.orderA.dualAuthAccountID).updateBalance(ring.orderA.tokenF, walletFee_A)

        self.updateAccountTree(ring.orderA.dualAuthAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderA.dualAuthAccountID))
        rootAfter = self._accountsTree._root
        accountUpdateA_W = AccountUpdateData(ring.orderA.dualAuthAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Update wallet B
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.orderB.dualAuthAccountID))
        proof = self._accountsTree.createProof(ring.orderB.dualAuthAccountID)

        balanceUpdateB_W = self.getAccount(ring.orderB.dualAuthAccountID).updateBalance(ring.orderB.tokenF, walletFee_B)

        self.updateAccountTree(ring.orderB.dualAuthAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.orderB.dualAuthAccountID))
        rootAfter = self._accountsTree._root
        accountUpdateB_W = AccountUpdateData(ring.orderB.dualAuthAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Update feeRecipient
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.feeRecipientAccountID))
        proof = self._accountsTree.createProof(ring.feeRecipientAccountID)

        balanceUpdateA_F = self.getAccount(ring.feeRecipientAccountID).updateBalance(ring.orderA.tokenF, matchingFee_A)
        balanceUpdateB_F = self.getAccount(ring.feeRecipientAccountID).updateBalance(ring.orderB.tokenF, matchingFee_B)

        self.updateAccountTree(ring.feeRecipientAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.feeRecipientAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_F = AccountUpdateData(ring.feeRecipientAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)


        # Update ringmatcher
        accountM = self.getAccount(ring.minerAccountID)

        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(ring.minerAccountID))
        proof = self._accountsTree.createProof(ring.minerAccountID)

        balanceUpdateM_M = accountM.updateBalance(ring.orderA.tokenS, int(ring.margin))
        balanceUpdateO_M = accountM.updateBalance(ring.tokenID, -int(ring.fee))
        accountM.nonce += 1

        self.updateAccountTree(ring.minerAccountID)
        accountAfter = copyAccountInfo(self.getAccount(ring.minerAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_M = AccountUpdateData(ring.minerAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###


        # Operator payment
        balanceUpdateF_O = self.getAccount(context.operatorAccountID).updateBalance(ring.tokenID, int(ring.fee))
        ###

        return RingSettlement(ring,
                              accountsMerkleRoot,
                              tradeHistoryUpdate_A, tradeHistoryUpdate_B,
                              balanceUpdateS_A, balanceUpdateB_A, balanceUpdateF_A, accountUpdate_A,
                              balanceUpdateS_B, balanceUpdateB_B, balanceUpdateF_B, accountUpdate_B,
                              balanceUpdateA_W, accountUpdateA_W,
                              balanceUpdateB_W, accountUpdateB_W,
                              balanceUpdateA_F, balanceUpdateB_F, accountUpdate_F,
                              balanceUpdateM_M, balanceUpdateO_M, accountUpdate_M,
                              balanceUpdateF_O,
                              walletFee_A, matchingFee_A,
                              walletFee_B, matchingFee_B)


    def deposit(self, accountID, secretKey, publicKeyX, publicKeyY, walletID, token, amount):
        # Copy the initial merkle root
        rootBefore = self._accountsTree._root

        if not(str(accountID) in self._accounts):
            accountBefore = copyAccountInfo(getDefaultAccount())
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

    def withdraw(self,
                 onchain,
                 realmID, accountID, tokenID, amount,
                 operatorAccountID, dualAuthAccountID, feeTokenID, fee, walletSplitPercentage):

        feeToWallet = int(fee) * walletSplitPercentage // 100
        feeToOperator = int(fee) - feeToWallet

        # Update account
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountID)

        balanceUpdateF_A = self.getAccount(accountID).updateBalance(feeTokenID, -fee)

        balance = int(self.getAccount(accountID).getBalance(tokenID))
        amountWithdrawn = int(amount) if (int(amount) < balance) else balance

        balanceUpdateW_A = self.getAccount(accountID).updateBalance(tokenID, -amountWithdrawn)
        if not onchain:
            self.getAccount(accountID).nonce += 1

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(dualAuthAccountID))
        proof = self._accountsTree.createProof(dualAuthAccountID)

        balanceUpdateF_W = self.getAccount(dualAuthAccountID).updateBalance(feeTokenID, feeToWallet)

        self.updateAccountTree(dualAuthAccountID)
        accountAfter = copyAccountInfo(self.getAccount(dualAuthAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_W = AccountUpdateData(dualAuthAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Operator payment
        balanceUpdateF_O = self.getAccount(operatorAccountID).updateBalance(feeTokenID, feeToOperator)

        account = self.getAccount(accountID)
        walletAccount = self.getAccount(dualAuthAccountID)
        withdrawal = Withdrawal(Point(int(account.publicKeyX), int(account.publicKeyY)),
                                Point(int(walletAccount.publicKeyX), int(walletAccount.publicKeyY)),
                                realmID,
                                accountID, tokenID, amount,
                                walletAccount.walletID, dualAuthAccountID,
                                operatorAccountID, feeTokenID, fee, walletSplitPercentage,
                                nonce,
                                amountWithdrawn,
                                balanceUpdateF_A, balanceUpdateW_A, accountUpdate_A,
                                balanceUpdateF_W, accountUpdate_W,
                                balanceUpdateF_O)
        withdrawal.sign(FQ(int(account.secretKey)), FQ(int(walletAccount.secretKey)))
        return withdrawal

    def cancelOrder(self,
                    realmID, accountID, orderTokenID, orderID, dualAuthAccountID,
                    operatorAccountID, feeTokenID, fee, walletSplitPercentage):

        feeToWallet = int(fee) * walletSplitPercentage // 100
        feeToOperator = int(fee) - feeToWallet

        # Update account
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(accountID))
        nonce = accountBefore.nonce
        proof = self._accountsTree.createProof(accountID)

        (balanceUpdateT_A, tradeHistoryUpdate_A) = self.getAccount(accountID).cancelOrder(orderTokenID, orderID)
        balanceUpdateF_A = self.getAccount(accountID).updateBalance(feeTokenID, -fee)
        self.getAccount(accountID).nonce += 1

        self.updateAccountTree(accountID)
        accountAfter = copyAccountInfo(self.getAccount(accountID))
        rootAfter = self._accountsTree._root
        accountUpdate_A = AccountUpdateData(accountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Update wallet
        rootBefore = self._accountsTree._root
        accountBefore = copyAccountInfo(self.getAccount(dualAuthAccountID))
        proof = self._accountsTree.createProof(dualAuthAccountID)

        balanceUpdateF_W = self.getAccount(dualAuthAccountID).updateBalance(feeTokenID, feeToWallet)

        self.updateAccountTree(dualAuthAccountID)
        accountAfter = copyAccountInfo(self.getAccount(dualAuthAccountID))
        rootAfter = self._accountsTree._root
        accountUpdate_W = AccountUpdateData(dualAuthAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
        ###

        # Operator payment
        balanceUpdateF_O = self.getAccount(operatorAccountID).updateBalance(feeTokenID, feeToOperator)

        account = self.getAccount(accountID)
        walletAccount = self.getAccount(dualAuthAccountID)
        cancellation = Cancellation(Point(int(account.publicKeyX), int(account.publicKeyY)),
                                    Point(int(walletAccount.publicKeyX), int(walletAccount.publicKeyY)),
                                    realmID,
                                    accountID, orderTokenID, orderID, walletAccount.walletID, dualAuthAccountID,
                                    operatorAccountID, feeTokenID, fee, walletSplitPercentage,
                                    nonce,
                                    tradeHistoryUpdate_A, balanceUpdateT_A, balanceUpdateF_A, accountUpdate_A,
                                    balanceUpdateF_W, accountUpdate_W,
                                    balanceUpdateF_O)
        cancellation.sign(FQ(int(account.secretKey)), FQ(int(walletAccount.secretKey)))
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

