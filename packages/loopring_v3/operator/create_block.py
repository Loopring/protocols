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
    stateID = int(jOrder["stateID"])
    walletID = int(jOrder["walletID"])
    orderID = int(jOrder["orderID"])
    accountID = int(jOrder["accountID"])
    dualAuthAccountID = int(jOrder["dualAuthAccountID"])
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
    walletAccount = state.getAccount(dualAuthAccountID)

    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(walletAccount.publicKeyX, walletAccount.publicKeyY),
                  stateID, walletID, orderID, accountID, dualAuthAccountID,
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
    dualAuthA = state.getAccount(orderA.dualAuthAccountID)
    dualAuthB = state.getAccount(orderB.dualAuthAccountID)

    ring = Ring(orderA, orderB, minerAccountID, feeRecipientAccountID, tokenID, fee, minerAccount.nonce)

    ring.sign(FQ(int(minerAccount.secretKey)), FQ(int(dualAuthA.secretKey)), FQ(int(dualAuthB.secretKey)))

    return ring


def deposit(state, data):
    export = DepositExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())

    for depositInfo in data:
        accountID = int(depositInfo["accountID"])
        secretKey = int(depositInfo["secretKey"])
        publicKeyX = int(depositInfo["publicKeyX"])
        publicKeyY = int(depositInfo["publicKeyY"])
        walletID = int(depositInfo["walletID"])
        token = int(depositInfo["tokenID"])
        amount = int(depositInfo["amount"])

        deposit = state.deposit(accountID, secretKey, publicKeyX, publicKeyY, walletID, token, amount)

        export.deposits.append(deposit)

    export.merkleRootAfter = str(state.getRoot())
    return export


def withdraw(onchain, state, data):
    export = WithdrawalExport(onchain)
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.operatorAccountID = int(data["operatorAccountID"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountID))

    for withdrawalInfo in data["withdrawals"]:
        accountID = int(withdrawalInfo["accountID"])
        tokenID = int(withdrawalInfo["tokenID"])
        amount = int(withdrawalInfo["amount"])
        dualAuthAccountID = int(withdrawalInfo["dualAuthAccountID"])
        feeTokenID = int(withdrawalInfo["feeTokenID"])
        fee = int(withdrawalInfo["fee"])
        walletSplitPercentage = int(withdrawalInfo["walletSplitPercentage"])

        withdrawal = state.withdraw(onchain, export.stateID, accountID, tokenID, amount,
                                             export.operatorAccountID, dualAuthAccountID, feeTokenID, fee, walletSplitPercentage)
        export.withdrawals.append(withdrawal)

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountID)
    state.updateAccountTree(export.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountID))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def cancel(state, data):
    export = CancelExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.operatorAccountID = int(data["operatorAccountID"])

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountID))

    for cancelInfo in data["cancels"]:
        accountID = int(cancelInfo["accountID"])
        orderTokenID = int(cancelInfo["orderTokenID"])
        orderID = int(cancelInfo["orderID"])
        dualAuthAccountID = int(cancelInfo["dualAuthAccountID"])
        feeTokenID = int(cancelInfo["feeTokenID"])
        fee = int(cancelInfo["fee"])
        walletSplitPercentage = int(cancelInfo["walletSplitPercentage"])

        export.cancels.append(state.cancelOrder(export.stateID, accountID, orderTokenID, orderID,
                                                dualAuthAccountID, export.operatorAccountID, feeTokenID, fee, walletSplitPercentage))

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountID)
    state.updateAccountTree(export.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountID))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def trade(state, data):
    export = TradeExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.timestamp = int(data["timestamp"])
    export.operatorAccountID = int(data["operatorAccountID"])

    context = Context(export.operatorAccountID, export.timestamp)

    # Operator payment
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountID))

    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        export.ringSettlements.append(ringSettlement)

    # Operator payment
    proof = state._accountsTree.createProof(export.operatorAccountID)
    state.updateAccountTree(export.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountID))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    export.merkleRootAfter = str(state.getRoot())
    return export


def main(stateID, blockIdx, blockType, inputFilename, outputFilename):
    previousBlockIdx = int(blockIdx) - 1
    previous_state_filename = "./states/state_" + str(stateID) + "_" + str(previousBlockIdx) + ".json"

    state = State(stateID)
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
    state_filename = "./states/state_" + str(stateID) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
