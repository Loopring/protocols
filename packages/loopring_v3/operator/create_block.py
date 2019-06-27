import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
import subprocess
import json
import pathlib
from state import Account, Context, State, Order, Ring, copyAccountInfo, AccountUpdateData
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ


class RingSettlementBlock(object):
    def __init__(self):
        self.blockType = 0
        self.ringSettlements = []

    def toJSON(self):
        self.blockSize = len(self.ringSettlements)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositBlock(object):
    def __init__(self):
        self.blockType = 1
        self.deposits = []

    def toJSON(self):
        self.blockSize = len(self.deposits)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class OnchainWithdrawalBlock(object):
    def __init__(self):
        self.blockType = 2
        self.withdrawals = []

    def toJSON(self):
        self.blockSize = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class OffchainWithdrawalBlock(object):
    def __init__(self):
        self.blockType = 3
        self.withdrawals = []

    def toJSON(self):
        self.blockSize = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class OrderCancellationBlock(object):
    def __init__(self):
        self.blockType = 4
        self.cancels = []

    def toJSON(self):
        self.blockSize = len(self.cancels)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder, state):
    exchangeID = int(jOrder["exchangeID"])
    orderID = int(jOrder["orderID"])
    accountID = int(jOrder["accountID"])
    dualAuthPublicKeyX = int(jOrder["dualAuthPublicKeyX"])
    dualAuthPublicKeyY = int(jOrder["dualAuthPublicKeyY"])
    dualAuthSecretKey = int(jOrder["dualAuthSecretKey"])
    tokenS = int(jOrder["tokenIdS"])
    tokenB = int(jOrder["tokenIdB"])
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    allOrNone = int(jOrder["allOrNone"])
    validSince = int(jOrder["validSince"])
    validUntil = int(jOrder["validUntil"])
    buy = int(jOrder["buy"])
    maxFeeBips = int(jOrder["maxFeeBips"])

    feeBips = int(jOrder["feeBips"])
    rebateBips = int(jOrder["rebateBips"])

    account = state.getAccount(accountID)

    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(dualAuthPublicKeyX, dualAuthPublicKeyY), dualAuthSecretKey,
                  exchangeID, orderID, accountID,
                  tokenS, tokenB,
                  amountS, amountB,
                  allOrNone, validSince, validUntil, buy,
                  maxFeeBips, feeBips, rebateBips)

    order.signature = jOrder["signature"]

    return order


def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)
    ringMatcherAccountID = int(jRing["ringMatcherAccountID"])
    tokenID = int(jRing["tokenID"])
    fee = int(jRing["fee"])

    ringMatcherAccount = state.getAccount(ringMatcherAccountID)

    ring = Ring(orderA, orderB, ringMatcherAccountID, tokenID, fee, ringMatcherAccount.nonce)

    ring.ringMatcherSignature = jRing["ringMatcherSignature"]
    ring.dualAuthASignature = jRing["dualAuthASignature"]
    ring.dualAuthBSignature = jRing["dualAuthBSignature"]

    return ring

def createRingSettlementBlock(state, data):
    block = RingSettlementBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.timestamp = int(data["timestamp"])
    block.protocolTakerFeeBips = int(data["protocolTakerFeeBips"])
    block.protocolMakerFeeBips = int(data["protocolMakerFeeBips"])
    block.operatorAccountID = int(data["operatorAccountID"])

    context = Context(block.operatorAccountID, block.timestamp, block.protocolTakerFeeBips, block.protocolMakerFeeBips)

    # Protocol fee payment / Operator payment
    accountBefore_P = copyAccountInfo(state.getAccount(0))

    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        block.ringSettlements.append(ringSettlement)

    # Protocol fee payment
    rootBefore = state._accountsTree._root
    proof = state._accountsTree.createProof(0)
    state.updateAccountTree(0)
    accountAfter = copyAccountInfo(state.getAccount(0))
    rootAfter = state._accountsTree._root
    block.accountUpdate_P = AccountUpdateData(0, proof, rootBefore, rootAfter, accountBefore_P, accountAfter)

    # Operator payments
    account = state.getAccount(context.operatorAccountID)
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(context.operatorAccountID))
    proof = state._accountsTree.createProof(context.operatorAccountID)
    for ringSettlement in block.ringSettlements:
        ringSettlement.balanceUpdateF_O = account.updateBalance(ringSettlement.ring.tokenID, ringSettlement.feeToOperator)
    state.updateAccountTree(context.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(context.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(context.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block

def createDepositBlock(state, data):
    block = DepositBlock()
    block.onchainDataAvailability = False
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.startHash = str(data["startHash"])
    block.startIndex = str(data["startIndex"])
    block.count = str(data["count"])

    for depositInfo in data["deposits"]:
        accountID = int(depositInfo["accountID"])
        secretKey = int(depositInfo["secretKey"])
        publicKeyX = int(depositInfo["publicKeyX"])
        publicKeyY = int(depositInfo["publicKeyY"])
        token = int(depositInfo["tokenID"])
        amount = int(depositInfo["amount"])

        deposit = state.deposit(accountID, secretKey, publicKeyX, publicKeyY, token, amount)

        block.deposits.append(deposit)

    block.merkleRootAfter = str(state.getRoot())
    return block

def createOnchainWithdrawalBlock(state, data):
    block = OnchainWithdrawalBlock()
    block.onchainDataAvailability = False
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.startHash = str(data["startHash"])
    block.startIndex = str(data["startIndex"])
    block.count = str(data["count"])

    # If count == 0 the exchange is shutdown and we do withdrawals that also reset
    # the state back to default values
    shutdown = int(block.count) == 0

    for withdrawalInfo in data["withdrawals"]:
        accountID = int(withdrawalInfo["accountID"])
        tokenID = int(withdrawalInfo["tokenID"])
        amount = int(withdrawalInfo["amount"])

        withdrawal = state.onchainWithdraw(block.exchangeID, accountID, tokenID, amount, shutdown)

        block.withdrawals.append(withdrawal)

    block.merkleRootAfter = str(state.getRoot())
    return block

def createOffchainWithdrawalBlock(state, data):
    block = OffchainWithdrawalBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.operatorAccountID = int(data["operatorAccountID"])

    for withdrawalInfo in data["withdrawals"]:
        accountID = int(withdrawalInfo["accountID"])
        tokenID = int(withdrawalInfo["tokenID"])
        amount = int(withdrawalInfo["amount"])
        walletAccountID = int(withdrawalInfo["walletAccountID"])
        feeTokenID = int(withdrawalInfo["feeTokenID"])
        fee = int(withdrawalInfo["fee"])
        walletSplitPercentage = int(withdrawalInfo["walletSplitPercentage"])

        withdrawal = state.offchainWithdraw(block.exchangeID, accountID, tokenID, amount,
                                            block.operatorAccountID, walletAccountID, feeTokenID, fee, walletSplitPercentage)
        withdrawal.signature = withdrawalInfo["signature"]
        block.withdrawals.append(withdrawal)

    # Operator payments
    account = state.getAccount(block.operatorAccountID)
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(block.operatorAccountID))
    proof = state._accountsTree.createProof(block.operatorAccountID)
    for withdrawal in block.withdrawals:
        withdrawal.balanceUpdateF_O = account.updateBalance(withdrawal.feeTokenID, withdrawal.feeToOperator)
    state.updateAccountTree(block.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(block.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(block.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block


def createOrderCancellationBlock(state, data):
    block = OrderCancellationBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.operatorAccountID = int(data["operatorAccountID"])

    for cancelInfo in data["cancels"]:
        accountID = int(cancelInfo["accountID"])
        orderTokenID = int(cancelInfo["orderTokenID"])
        orderID = int(cancelInfo["orderID"])
        walletAccountID = int(cancelInfo["walletAccountID"])
        feeTokenID = int(cancelInfo["feeTokenID"])
        fee = int(cancelInfo["fee"])
        walletSplitPercentage = int(cancelInfo["walletSplitPercentage"])

        cancel = state.cancelOrder(block.exchangeID, accountID, orderTokenID, orderID,
                                   walletAccountID, block.operatorAccountID, feeTokenID, fee, walletSplitPercentage)

        cancel.signature = cancelInfo["signature"]
        block.cancels.append(cancel)

    # Operator payments
    account = state.getAccount(block.operatorAccountID)
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(block.operatorAccountID))
    proof = state._accountsTree.createProof(block.operatorAccountID)
    for cancel in block.cancels:
        cancel.balanceUpdateF_O = account.updateBalance(cancel.feeTokenID, cancel.feeToOperator)
    state.updateAccountTree(block.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(block.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(block.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block


def main(exchangeID, blockIdx, blockType, inputFilename, outputFilename):
    previousBlockIdx = int(blockIdx) - 1
    previous_state_filename = "./states/state_" + str(exchangeID) + "_" + str(previousBlockIdx) + ".json"

    state = State(exchangeID)
    if os.path.exists(previous_state_filename):
        state.load(previous_state_filename)

    with open(inputFilename) as f:
        data = json.load(f)

    #blockType = data["blockType"]

    if blockType == "0":
        block = createRingSettlementBlock(state, data)
    elif blockType == "1":
        block = createDepositBlock(state, data)
    elif blockType == "2":
        block = createOnchainWithdrawalBlock(state, data)
    elif blockType == "3":
        block = createOffchainWithdrawalBlock(state, data)
    elif blockType == "4":
        block = createOrderCancellationBlock(state, data)
    else:
        raise Exception("Unknown block type")

    f = open(outputFilename,"w+")
    f.write(block.toJSON())
    f.close()

    # Validate the block
    subprocess.check_call(["build/circuit/dex_circuit", "-validate", outputFilename])

    pathlib.Path("./states").mkdir(parents=True, exist_ok=True)
    state_filename = "./states/state_" + str(exchangeID) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
