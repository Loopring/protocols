import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
import subprocess
import json
from state import Account, Context, GlobalState, State, Order, Ring, copyAccountInfo, AccountUpdateData
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
    minerID = int(jRing["minerID"])
    minerAccountID = int(jRing["minerAccountID"])
    fee = int(jRing["fee"])

    minerAccount = state.getAccount(minerAccountID)
    dualAuthA = state.getAccount(orderA.dualAuthAccountID)
    dualAuthB = state.getAccount(orderB.dualAuthAccountID)

    ring = Ring(orderA, orderB,
                Point(minerAccount.publicKeyX, minerAccount.publicKeyY),
                minerID, minerAccountID,
                fee,
                minerAccount.nonce)

    ring.sign(FQ(int(minerAccount.secretKey)), FQ(int(dualAuthA.secretKey)), FQ(int(dualAuthB.secretKey)))

    return ring


def deposit(state, data):
    export = DepositExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.feesRootBefore = str(state.getFeesRoot())
    export.accountsRootBefore = str(state.getAccountsRoot())

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
    export.feesRootAfter = str(state.getFeesRoot())
    export.accountsRootAfter = str(state.getAccountsRoot())
    return export


def withdraw(onchain, state, data):
    export = WithdrawalExport(onchain)
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.feesRootBefore = str(state.getFeesRoot())
    export.accountsRootBefore = str(state.getAccountsRoot())

    for withdrawalInfo in data:
        withdrawal = state.withdraw(onchain, int(withdrawalInfo["accountID"]), int(withdrawalInfo["tokenID"]), int(withdrawalInfo["amount"]))
        export.withdrawals.append(withdrawal)

    export.merkleRootAfter = str(state.getRoot())
    export.feesRootAfter = str(state.getFeesRoot())
    export.accountsRootAfter = str(state.getAccountsRoot())
    return export


def cancel(state, data):
    export = CancelExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.feesRootBefore = str(state.getFeesRoot())
    export.accountsRootBefore = str(state.getAccountsRoot())

    for cancelInfo in data:
        accountID = int(cancelInfo["accountID"])
        tokenID = int(cancelInfo["tokenID"])
        orderID = int(cancelInfo["orderID"])

        export.cancels.append(state.cancelOrder(accountID, tokenID, orderID))

    export.merkleRootAfter = str(state.getRoot())
    export.feesRootAfter = str(state.getFeesRoot())
    export.accountsRootAfter = str(state.getAccountsRoot())
    return export


def trade(state, data):

    global_state_filename = "state_global.json"
    global_state = GlobalState()
    if os.path.exists(global_state_filename):
        global_state.load(global_state_filename)

    export = TradeExport()
    export.stateID = state.stateID
    export.merkleRootBefore = str(state.getRoot())
    export.feesRootBefore = str(state.getFeesRoot())
    export.accountsRootBefore = str(state.getAccountsRoot())
    export.burnRateMerkleRoot = str(global_state._tokensTree.root)
    export.timestamp = int(data["timestamp"])
    export.operatorAccountID = int(data["operatorAccountID"])

    context = Context(global_state, export.operatorAccountID, export.timestamp)

    totalFee = 0
    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        totalFee += ring.fee
        export.ringSettlements.append(ringSettlement)

    # Total payment to operator
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(export.operatorAccountID))
    proof = state._accountsTree.createProof(export.operatorAccountID)

    export.balanceUpdate_O = state.getAccount(export.operatorAccountID).updateBalance(1, totalFee)

    state.updateAccountTree(export.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(export.operatorAccountID))
    rootAfter = state._accountsTree._root
    export.accountUpdate_O = AccountUpdateData(export.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)
    ###

    export.merkleRootAfter = str(state.getRoot())
    export.feesRootAfter = str(state.getFeesRoot())
    export.accountsRootAfter = str(state.getAccountsRoot())
    return export


def main(stateID, blockType, inputFilename, outputFilename):
    state_filename = "state_" + str(stateID) + ".json"

    state = State(stateID)
    if os.path.exists(state_filename):
        state.load(state_filename)

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

    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
