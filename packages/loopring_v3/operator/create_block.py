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
        self.numElements = len(self.ringSettlements)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositBlock(object):
    def __init__(self):
        self.blockType = 1
        self.deposits = []

    def toJSON(self):
        self.numElements = len(self.deposits)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class OnchainWithdrawalBlock(object):
    def __init__(self):
        self.blockType = 2
        self.withdrawals = []

    def toJSON(self):
        self.numElements = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class OffchainWithdrawalBlock(object):
    def __init__(self):
        self.blockType = 3
        self.withdrawals = []

    def toJSON(self):
        self.numElements = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class OrderCancellationBlock(object):
    def __init__(self):
        self.blockType = 4
        self.cancels = []

    def toJSON(self):
        self.numElements = len(self.cancels)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder, state):
    realmID = int(jOrder["realmID"])
    orderID = int(jOrder["orderID"])
    accountID = int(jOrder["accountID"])
    walletAccountID = int(jOrder["walletAccountID"])
    dualAuthPublicKeyX = int(jOrder["dualAuthPublicKeyX"])
    dualAuthPublicKeyY = int(jOrder["dualAuthPublicKeyY"])
    dualAuthSecretKey = int(jOrder["dualAuthSecretKey"])
    tokenS = int(jOrder["tokenIdS"])
    tokenB = int(jOrder["tokenIdB"])
    tokenF = int(jOrder["tokenIdF"])
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    amountF = int(jOrder["amountF"])
    allOrNone = int(jOrder["allOrNone"])
    validSince = int(jOrder["validSince"])
    validUntil = int(jOrder["validUntil"])
    walletSplitPercentage = int(jOrder["walletSplitPercentage"])
    waiveFeePercentage = int(jOrder["waiveFeePercentage"])

    account = state.getAccount(accountID)
    walletAccount = state.getAccount(walletAccountID)

    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(walletAccount.publicKeyX, walletAccount.publicKeyY),
                  Point(dualAuthPublicKeyX, dualAuthPublicKeyY), dualAuthSecretKey,
                  realmID, orderID, accountID, walletAccountID,
                  tokenS, tokenB, tokenF,
                  amountS, amountB, amountF,
                  allOrNone, validSince, validUntil,
                  walletSplitPercentage, waiveFeePercentage)

    order.sign(FQ(int(account.secretKey)))

    return order


def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)
    minerAccountID = int(jRing["minerAccountID"])
    feeRecipientAccountID = int(jRing["feeRecipientAccountID"])
    tokenID = int(jRing["tokenID"])
    fee = int(jRing["fee"])

    minerAccount = state.getAccount(minerAccountID)

    ring = Ring(orderA, orderB, minerAccountID, feeRecipientAccountID, tokenID, fee, minerAccount.nonce)

    ring.sign(FQ(int(minerAccount.secretKey)), FQ(int(orderA.dualAuthSecretKey)), FQ(int(orderB.dualAuthSecretKey)))

    return ring

def createRingSettlementBlock(state, data):
    block = RingSettlementBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.realmID = state.realmID
    block.merkleRootBefore = str(state.getRoot())
    block.timestamp = int(data["timestamp"])
    block.operatorAccountID = int(data["operatorAccountID"])

    context = Context(block.operatorAccountID, block.timestamp)

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(block.operatorAccountID))

    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        block.ringSettlements.append(ringSettlement)

    # Operator payment
    proof = state._accountsTree.createProof(block.operatorAccountID)
    state.updateAccountTree(block.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(block.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(block.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block

def createDepositBlock(state, data):
    block = DepositBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.realmID = state.realmID
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
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.realmID = state.realmID
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

        withdrawal = state.onchainWithdraw(block.realmID, accountID, tokenID, amount, shutdown)

        block.withdrawals.append(withdrawal)

    block.merkleRootAfter = str(state.getRoot())
    return block

def createOffchainWithdrawalBlock(state, data):
    block = OffchainWithdrawalBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.realmID = state.realmID
    block.merkleRootBefore = str(state.getRoot())
    block.operatorAccountID = int(data["operatorAccountID"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(block.operatorAccountID))

    for withdrawalInfo in data["withdrawals"]:
        accountID = int(withdrawalInfo["accountID"])
        tokenID = int(withdrawalInfo["tokenID"])
        amount = int(withdrawalInfo["amount"])
        walletAccountID = int(withdrawalInfo["walletAccountID"])
        feeTokenID = int(withdrawalInfo["feeTokenID"])
        fee = int(withdrawalInfo["fee"])
        walletSplitPercentage = int(withdrawalInfo["walletSplitPercentage"])

        withdrawal = state.offchainWithdraw(block.realmID, accountID, tokenID, amount,
                                            block.operatorAccountID, walletAccountID, feeTokenID, fee, walletSplitPercentage)
        block.withdrawals.append(withdrawal)

    # Operator payment
    proof = state._accountsTree.createProof(block.operatorAccountID)
    state.updateAccountTree(block.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(block.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(block.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block


def createOrderCancellationBlock(state, data):
    block = OrderCancellationBlock()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.realmID = state.realmID
    block.merkleRootBefore = str(state.getRoot())
    block.operatorAccountID = int(data["operatorAccountID"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(block.operatorAccountID))

    for cancelInfo in data["cancels"]:
        accountID = int(cancelInfo["accountID"])
        orderTokenID = int(cancelInfo["orderTokenID"])
        orderID = int(cancelInfo["orderID"])
        walletAccountID = int(cancelInfo["walletAccountID"])
        feeTokenID = int(cancelInfo["feeTokenID"])
        fee = int(cancelInfo["fee"])
        walletSplitPercentage = int(cancelInfo["walletSplitPercentage"])

        block.cancels.append(state.cancelOrder(block.realmID, accountID, orderTokenID, orderID,
                                               walletAccountID, block.operatorAccountID, feeTokenID, fee, walletSplitPercentage))

    # Operator payment
    proof = state._accountsTree.createProof(block.operatorAccountID)
    state.updateAccountTree(block.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(block.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(block.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block


def main(realmID, blockIdx, blockType, inputFilename, outputFilename):
    previousBlockIdx = int(blockIdx) - 1
    previous_state_filename = "./states/state_" + str(realmID) + "_" + str(previousBlockIdx) + ".json"

    state = State(realmID)
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
    state_filename = "./states/state_" + str(realmID) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
