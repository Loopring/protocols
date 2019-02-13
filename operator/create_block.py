import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
import subprocess
import json
from state import Account, Context, GlobalState,State, Order, Ring
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ


class TradeExport(object):
    def __init__(self):
        self.blockType = 0
        self.ringSettlements = []
        self.tradingHistoryMerkleRootBefore = 0
        self.tradingHistoryMerkleRootAfter = 0
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0
        self.timestamp = 0
        self.stateID = 0

    def toJSON(self):
        self.numElements = len(self.ringSettlements)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositExport(object):
    def __init__(self):
        self.blockType = 1
        self.deposits = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0
        self.stateID = 0

    def toJSON(self):
        self.numElements = len(self.deposits)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class WithdrawalExport(object):
    def __init__(self):
        self.blockType = 2
        self.withdrawals = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0
        self.stateID = 0

    def toJSON(self):
        self.numElements = len(self.withdrawals)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class CancelExport(object):
    def __init__(self):
        self.blockType = 3
        self.cancels = []
        self.tradingHistoryMerkleRootBefore = 0
        self.tradingHistoryMerkleRootAfter = 0
        self.accountsMerkleRoot = 0
        self.stateID = 0

    def toJSON(self):
        self.numElements = len(self.cancels)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder, state):
    walletID = int(jOrder["walletID"])
    orderID = int(jOrder["orderID"])
    accountS = int(jOrder["accountS"])
    accountB = int(jOrder["accountB"])
    accountF = int(jOrder["accountF"])
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    amountF = int(jOrder["amountF"])
    tokenS = int(jOrder["tokenIdS"])
    tokenB = int(jOrder["tokenIdB"])
    tokenF = int(jOrder["tokenIdF"])
    walletF = int(jOrder["walletF"])
    minerS = int(jOrder["minerS"])
    minerF = int(jOrder["minerF"])
    allOrNone = int(jOrder["allOrNone"])
    validSince = int(jOrder["validSince"])
    validUntil = int(jOrder["validUntil"])
    walletSplitPercentage = int(jOrder["walletSplitPercentage"])
    waiveFeePercentage = int(jOrder["waiveFeePercentage"])
    stateID = int(jOrder["stateID"])

    account = state.getAccount(accountS)
    wallet = state.getAccount(walletF)
    miner_F = state.getAccount(minerF)
    miner_S = state.getAccount(minerS)
    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(wallet.publicKeyX, wallet.publicKeyY),
                  Point(miner_F.publicKeyX, miner_F.publicKeyY),
                  Point(miner_S.publicKeyX, miner_S.publicKeyY),
                  walletID, orderID,
                  accountS, accountB, accountF, walletF, minerF, minerS,
                  amountS, amountB, amountF,
                  tokenS, tokenB, tokenF,
                  allOrNone, validSince, validUntil,
                  walletSplitPercentage, waiveFeePercentage,
                  stateID)

    order.sign(FQ(int(account.secretKey)))

    return order


def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)
    minerID = int(jRing["miner"])
    fee = int(jRing["fee"])

    miner = state.getAccount(minerID)
    walletA = state.getAccount(orderA.walletF)
    walletB = state.getAccount(orderB.walletF)

    ring = Ring(orderA, orderB,
                Point(miner.publicKeyX, miner.publicKeyY),
                minerID, fee,
                miner.nonce)

    ring.sign(FQ(int(miner.secretKey)), FQ(int(walletA.secretKey)), FQ(int(walletB.secretKey)))

    return ring


def deposit(state, data):
    export = DepositExport()
    export.stateID = state.stateID
    export.accountsMerkleRootBefore = str(state._accountsTree._root)

    for depositInfo in data:
        deposit = state.deposit(int(depositInfo["accountID"]),
                                Account(int(depositInfo["secretKey"]),
                                        Point(int(depositInfo["publicKeyX"]), int(depositInfo["publicKeyY"])),
                                        int(depositInfo["walletID"]), int(depositInfo["tokenID"]), int(depositInfo["balance"])))
        export.deposits.append(deposit)

    export.accountsMerkleRootAfter = str(state._accountsTree._root)
    return export


def withdraw(state, data):
    export = WithdrawalExport()
    export.stateID = state.stateID
    export.accountsMerkleRootBefore = str(state._accountsTree._root)

    for withdrawalInfo in data:
        withdrawal = state.withdraw(int(withdrawalInfo["account"]), int(withdrawalInfo["amount"]))
        export.withdrawals.append(withdrawal)

    export.accountsMerkleRootAfter = str(state._accountsTree._root)
    return export


def cancel(state, data):
    export = CancelExport()
    export.stateID = state.stateID
    export.tradingHistoryMerkleRootBefore = str(state._tradingHistoryTree._root)
    export.accountsMerkleRoot = str(state._accountsTree._root)

    for i in range(2):
        export.cancels.append(state.cancelOrder(0, 2 + i))

    export.tradingHistoryMerkleRootAfter = str(state._tradingHistoryTree._root)
    return export


def trade(state, data):

    global_state_filename = "state_global.json"
    global_state = GlobalState()
    if os.path.exists(global_state_filename):
        global_state.load(global_state_filename)

    export = TradeExport()
    export.stateID = state.stateID
    export.tradingHistoryMerkleRootBefore = str(state._tradingHistoryTree._root)
    export.accountsMerkleRootBefore = str(state._accountsTree._root)
    export.burnRateMerkleRoot = str(global_state._tokensTree.root)
    export.timestamp = int(data["timestamp"])
    export.operatorID = int(data["operator"])

    context = Context(global_state, export.operatorID, export.timestamp)

    totalFee = 0
    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, state)
        ringSettlement = state.settleRing(context, ring)
        totalFee += ring.fee
        export.ringSettlements.append(ringSettlement)

    export.accountUpdate_O = state.updateBalance(export.operatorID, totalFee)

    export.tradingHistoryMerkleRootAfter = str(state._tradingHistoryTree._root)
    export.accountsMerkleRootAfter = str(state._accountsTree._root)
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
        output = withdraw(state, data)
    if blockType == "3":
        output = cancel(state, data)

    f = open(outputFilename,"w+")
    f.write(output.toJSON())
    f.close()

    # Validate the block
    subprocess.check_call(["build/circuit/dex_circuit", "-validate", outputFilename])

    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
