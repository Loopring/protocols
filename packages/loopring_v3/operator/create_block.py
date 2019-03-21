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


class TradeExport(object):
    def __init__(self):
        self.blockType = 0
        self.ringSettlements = []

    def toJSON(self):
        self.numElements = len(self.ringSettlements)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositExport(object):
    def __init__(self):
        self.blockType = 1
        self.deposits = []

    def toJSON(self):
        self.numElements = len(self.deposits)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class WithdrawalExport(object):
    def __init__(self, onchain):
        self.blockType = 2 if onchain else 3
        self.withdrawals = []

    def toJSON(self):
        self.numElements = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class CancelExport(object):
    def __init__(self):
        self.blockType = 4
        self.cancels = []

    def toJSON(self):
        self.numElements = len(self.cancels)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder, state):
    stateId = int(jOrder["stateId"])
    walletId = int(jOrder["walletId"])
    orderId = int(jOrder["orderId"])
    accountId = int(jOrder["accountId"])
    dualAuthAccountId = int(jOrder["dualAuthAccountId"])
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

    account = state.getAccount(accountId)
    walletAccount = state.getAccount(dualAuthAccountId)

    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(walletAccount.publicKeyX, walletAccount.publicKeyY),
                  stateId, walletId, orderId, accountId, dualAuthAccountId,
                  tokenS, tokenB, tokenF,
                  amountS, amountB, amountF,
                  allOrNone, validSince, validUntil,
                  walletSplitPercentage, waiveFeePercentage)

    order.sign(FQ(int(account.secretKey)))

    return order


def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)
    minerAccountId = int(jRing["minerAccountId"])
    feeRecipientAccountId = int(jRing["feeRecipientAccountId"])
    tokenId = int(jRing["tokenId"])
    fee = int(jRing["fee"])

    minerAccount = state.getAccount(minerAccountId)
    dualAuthA = state.getAccount(orderA.dualAuthAccountId)
    dualAuthB = state.getAccount(orderB.dualAuthAccountId)

    ring = Ring(orderA, orderB, minerAccountId, feeRecipientAccountId, tokenId, fee, minerAccount.nonce)

    ring.sign(FQ(int(minerAccount.secretKey)), FQ(int(dualAuthA.secretKey)), FQ(int(dualAuthB.secretKey)))

    return ring


def deposit(state, data):
    export = DepositExport()
    export.stateId = state.stateId
    export.merkleRootBefore = str(state.getRoot())

    for depositInfo in data:
        accountId = int(depositInfo["accountId"])
        secretKey = int(depositInfo["secretKey"])
        publicKeyX = int(depositInfo["publicKeyX"])
        publicKeyY = int(depositInfo["publicKeyY"])
        walletId = int(depositInfo["walletId"])
        token = int(depositInfo["tokenId"])
        amount = int(depositInfo["amount"])

        deposit = state.deposit(accountId, secretKey, publicKeyX, publicKeyY, walletId, token, amount)

        export.deposits.append(deposit)

    export.merkleRootAfter = str(state.getRoot())
    return export


def withdraw(onchain, state, data):
    export = WithdrawalExport(onchain)
    export.stateId = state.stateId
    export.merkleRootBefore = str(state.getRoot())
    export.operatorAccountId = int(data["operatorAccountId"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountId))

    for withdrawalInfo in data["withdrawals"]:
        accountId = int(withdrawalInfo["accountId"])
        tokenId = int(withdrawalInfo["tokenId"])
        amount = int(withdrawalInfo["amount"])
        dualAuthAccountId = int(withdrawalInfo["dualAuthAccountId"])
        feeTokenID = int(withdrawalInfo["feeTokenID"])
        fee = int(withdrawalInfo["fee"])
        walletSplitPercentage = int(withdrawalInfo["walletSplitPercentage"])

        withdrawal = state.withdraw(onchain, export.stateId, accountId, tokenId, amount,
                                             export.operatorAccountId, dualAuthAccountId, feeTokenID, fee, walletSplitPercentage)
        export.withdrawals.append(withdrawal)

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountId)
    state.updateAccountTree(export.operatorAccountId)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountId))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountId, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def cancel(state, data):
    export = CancelExport()
    export.stateId = state.stateId
    export.merkleRootBefore = str(state.getRoot())
    export.operatorAccountId = int(data["operatorAccountId"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountId))

    for cancelInfo in data["cancels"]:
        accountId = int(cancelInfo["accountId"])
        orderTokenID = int(cancelInfo["orderTokenID"])
        orderId = int(cancelInfo["orderId"])
        dualAuthAccountId = int(cancelInfo["dualAuthAccountId"])
        feeTokenID = int(cancelInfo["feeTokenID"])
        fee = int(cancelInfo["fee"])
        walletSplitPercentage = int(cancelInfo["walletSplitPercentage"])

        export.cancels.append(state.cancelOrder(export.stateId, accountId, orderTokenID, orderId,
                                                dualAuthAccountId, export.operatorAccountId, feeTokenID, fee, walletSplitPercentage))

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountId)
    state.updateAccountTree(export.operatorAccountId)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountId))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountId, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def trade(state, data):
    export = TradeExport()
    export.stateId = state.stateId
    export.merkleRootBefore = str(state.getRoot())
    export.timestamp = int(data["timestamp"])
    export.operatorAccountId = int(data["operatorAccountId"])

    context = Context(export.operatorAccountId, export.timestamp)

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountId))

    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        export.ringSettlements.append(ringSettlement)

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountId)
    state.updateAccountTree(export.operatorAccountId)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountId))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountId, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def main(stateId, blockIdx, blockType, inputFilename, outputFilename):
    previousBlockIdx = int(blockIdx) - 1
    previous_state_filename = "./states/state_" + str(stateId) + "_" + str(previousBlockIdx) + ".json"

    state = State(stateId)
    if os.path.exists(previous_state_filename):
        state.load(previous_state_filename)

    with open(inputFilename) as f:
        data = json.load(f)

    #blockType = data["blockType"]

    if blockType == "0":
        output = trade(state, data)
    if blockType == "1":
        output = deposit(state, data)
    if blockType == "2":
        output = withdraw(True, state, data)
    if blockType == "3":
        output = withdraw(False, state, data)
    if blockType == "4":
        output = cancel(state, data)

    f = open(outputFilename,"w+")
    f.write(output.toJSON())
    f.close()

    # Validate the block
    subprocess.check_call(["build/circuit/dex_circuit", "-validate", outputFilename])

    pathlib.Path("./states").mkdir(parents=True, exist_ok=True)
    state_filename = "./states/state_" + str(stateId) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
