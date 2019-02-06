import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'circuit')
import os.path
import subprocess
import json
from dex import Account, Context, Dex, Order, Ring
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

    def toJSON(self):
        self.numElements = len(self.ringSettlements)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositExport(object):
    def __init__(self):
        self.blockType = 1
        self.deposits = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

    def toJSON(self):
        self.numElements = len(self.deposits)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class WithdrawalExport(object):
    def __init__(self):
        self.blockType = 2
        self.withdrawals = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

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

    def toJSON(self):
        self.numElements = len(self.cancels)
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder, dex):
    dexID = int(jOrder["dexID"])
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

    account = dex.getAccount(accountS)
    wallet = dex.getAccount(walletF)
    miner_F = dex.getAccount(minerF)
    miner_S = dex.getAccount(minerS)
    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(wallet.publicKeyX, wallet.publicKeyY),
                  Point(miner_F.publicKeyX, miner_F.publicKeyY),
                  Point(miner_S.publicKeyX, miner_S.publicKeyY),
                  dexID, orderID,
                  accountS, accountB, accountF, walletF, minerF, minerS,
                  amountS, amountB, amountF,
                  tokenS, tokenB, tokenF,
                  allOrNone, validSince, validUntil,
                  walletSplitPercentage, waiveFeePercentage)

    order.sign(FQ(int(account.secretKey)))

    return order


def ringFromJSON(jRing, dex):
    orderA = orderFromJSON(jRing["orderA"], dex)
    orderB = orderFromJSON(jRing["orderB"], dex)
    minerID = int(jRing["miner"])
    fee = int(jRing["fee"])

    miner = dex.getAccount(minerID)
    walletA = dex.getAccount(orderA.walletF)
    walletB = dex.getAccount(orderB.walletF)

    ring = Ring(orderA, orderB,
                Point(miner.publicKeyX, miner.publicKeyY),
                minerID, fee,
                miner.nonce)

    ring.sign(FQ(int(miner.secretKey)), FQ(int(walletA.secretKey)), FQ(int(walletB.secretKey)))

    return ring


def deposit(dex, data):
    export = DepositExport()
    export.accountsMerkleRootBefore = str(dex._accountsTree._root)

    for depositInfo in data:
        deposit = dex.deposit(Account(int(depositInfo["secretKey"]),
                                      Point(int(depositInfo["publicKeyX"]), int(depositInfo["publicKeyY"])),
                                      int(depositInfo["dexID"]), int(depositInfo["tokenID"]), int(depositInfo["balance"])))
        export.deposits.append(deposit)

    export.accountsMerkleRootAfter = str(dex._accountsTree._root)
    return export


def withdraw(dex, data):
    export = WithdrawalExport()
    export.accountsMerkleRootBefore = str(dex._accountsTree._root)

    for withdrawalInfo in data:
        withdrawal = dex.withdraw(int(withdrawalInfo["account"]), int(withdrawalInfo["amount"]))
        export.withdrawals.append(withdrawal)

    export.accountsMerkleRootAfter = str(dex._accountsTree._root)
    return export


def cancel(dex, data):
    export = CancelExport()
    export.tradingHistoryMerkleRootBefore = str(dex._tradingHistoryTree._root)
    export.accountsMerkleRoot = str(dex._accountsTree._root)

    for i in range(2):
        export.cancels.append(dex.cancelOrder(0, 2 + i))

    export.tradingHistoryMerkleRootAfter = str(dex._tradingHistoryTree._root)
    return export


def trade(dex, data):
    export = TradeExport()
    export.tradingHistoryMerkleRootBefore = str(dex._tradingHistoryTree._root)
    export.accountsMerkleRootBefore = str(dex._accountsTree._root)
    export.burnRateMerkleRoot = str(dex._tokensTree.root)
    export.timestamp = int(data["timestamp"])
    export.operatorID = int(data["operator"])

    context = Context(export.operatorID, export.timestamp)

    totalFee = 0
    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, dex)
        ringSettlement = dex.settleRing(context, ring)
        totalFee += ring.fee
        export.ringSettlements.append(ringSettlement)

    export.accountUpdate_O = dex.updateBalance(export.operatorID, totalFee)

    export.tradingHistoryMerkleRootAfter = str(dex._tradingHistoryTree._root)
    export.accountsMerkleRootAfter = str(dex._accountsTree._root)
    return export


def main(blockType, inputFilename, outputFilename):
    dex_state_filename = "dex.json"

    dex = Dex()
    if os.path.exists(dex_state_filename):
        dex.loadState(dex_state_filename)

    with open(inputFilename) as f:
        data = json.load(f)

    #blockType = data["blockType"]

    if blockType == "0":
        output = trade(dex, data)
    if blockType == "1":
        output = deposit(dex, data)
    if blockType == "2":
        output = withdraw(dex, data)
    if blockType == "3":
        output = cancel(dex, data)

    f = open(outputFilename,"w+")
    f.write(output.toJSON())
    f.close()

    # Verify the block
    subprocess.check_call(["build/circuit/dex_circuit", "-verify", outputFilename])

    dex.saveState(dex_state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
