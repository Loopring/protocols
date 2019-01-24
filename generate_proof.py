import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'circuit')
import os.path
import subprocess
import json
from dex import Account, Dex, Order, Ring
from ethsnarks.eddsa import eddsa_random_keypair
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ


class TradeExport(object):
    def __init__(self):
        self.ringSettlements = []
        self.tradingHistoryMerkleRootBefore = 0
        self.tradingHistoryMerkleRootAfter = 0
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class DepositExport(object):
    def __init__(self):
        self.deposits = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


class WithdrawalExport(object):
    def __init__(self):
        self.withdrawals = []
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class CancelExport(object):
    def __init__(self):
        self.cancels = []
        self.tradingHistoryMerkleRootBefore = 0
        self.tradingHistoryMerkleRootAfter = 0
        self.accountsMerkleRoot = 0

    def toJSON(self):
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
    walletF = 6

    account = dex.getAccount(accountS)
    wallet = dex.getAccount(walletF)
    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  Point(wallet.publicKeyX, wallet.publicKeyY),
                  dexID, orderID,
                  accountS, accountB, accountF, walletF,
                  amountS, amountB, amountF,
                  tokenS, tokenB, tokenF)
    order.sign(FQ(int(account.secretKey)))

    return order


def ringFromJSON(jRing, dex):
    orderA = orderFromJSON(jRing["orderA"], dex)
    orderB = orderFromJSON(jRing["orderB"], dex)

    fillS_A = int(jRing["fillS_A"])
    fillB_A = int(jRing["fillB_A"])
    fillF_A = int(jRing["fillF_A"])

    fillS_B = int(jRing["fillS_B"])
    fillB_B = int(jRing["fillB_B"])
    fillF_B = int(jRing["fillF_B"])

    return Ring(orderA, orderB, fillS_A, fillB_A, fillF_A, fillS_B, fillB_B, fillF_B)


def main():
    dex_state_filename = "dex.json"

    with open('rings_info.json') as f:
        data = json.load(f)

    dex = Dex()
    if os.path.exists(dex_state_filename):
        dex.loadState(dex_state_filename)

    #
    # Deposits
    #

    depositExport = DepositExport()
    depositExport.accountsMerkleRootBefore = str(dex._accountsTree._root)

    (secretKeyW, publicKeyW) = eddsa_random_keypair()

    (secretKeyA, publicKeyA) = eddsa_random_keypair()
    depositExport.deposits.append(dex.addAccount(Account(secretKeyA, publicKeyA, 0, 1, 100)))
    depositExport.deposits.append(dex.addAccount(Account(secretKeyA, publicKeyA, 0, 2, 100)))
    depositExport.deposits.append(dex.addAccount(Account(secretKeyA, publicKeyA, 0, 3, 100)))

    (secretKeyB, publicKeyB) = eddsa_random_keypair()
    depositExport.deposits.append(dex.addAccount(Account(secretKeyB, publicKeyB, 0, 1, 100)))
    depositExport.deposits.append(dex.addAccount(Account(secretKeyB, publicKeyB, 0, 2, 100)))
    depositExport.deposits.append(dex.addAccount(Account(secretKeyB, publicKeyB, 0, 3, 100)))

    depositExport.deposits.append(dex.addAccount(Account(secretKeyW, publicKeyW, 0, 3, 100)))

    depositExport.accountsMerkleRootAfter = str(dex._accountsTree._root)

    f = open("deposits.json","w+")
    f.write(depositExport.toJSON())
    f.close()

    # Create the proof
    subprocess.check_call(["build/circuit/dex_circuit", str(1), str(len(depositExport.deposits)), "deposits.json"])


    #
    # Withdrawals
    #

    withdrawalExport = WithdrawalExport()
    withdrawalExport.accountsMerkleRootBefore = str(dex._accountsTree._root)

    for _ in range(1):
        withdrawalExport.withdrawals.append(dex.withdraw(0, 1))

    withdrawalExport.accountsMerkleRootAfter = str(dex._accountsTree._root)

    f = open("withdrawals.json","w+")
    f.write(withdrawalExport.toJSON())
    f.close()

    # Create the proof
    subprocess.check_call(["build/circuit/dex_circuit", str(2), str(len(withdrawalExport.withdrawals)), "withdrawals.json"])


    #
    # Cancels
    #

    cancelExport = CancelExport()
    cancelExport.tradingHistoryMerkleRootBefore = str(dex._tradingHistoryTree._root)
    cancelExport.accountsMerkleRoot = str(dex._accountsTree._root)

    for i in range(10):
        cancelExport.cancels.append(dex.cancelOrder(0, 2 + i))

    cancelExport.tradingHistoryMerkleRootAfter = str(dex._tradingHistoryTree._root)

    f = open("cancels.json","w+")
    f.write(cancelExport.toJSON())
    f.close()

    # Create the proof
    subprocess.check_call(["build/circuit/dex_circuit", str(3), str(len(cancelExport.cancels)), "cancels.json"])


    #
    # Trades
    #

    export = TradeExport()
    export.tradingHistoryMerkleRootBefore = str(dex._tradingHistoryTree._root)
    export.accountsMerkleRootBefore = str(dex._accountsTree._root)
    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo, dex)
        ringSettlement = dex.settleRing(ring)
        export.ringSettlements.append(ringSettlement)
    export.tradingHistoryMerkleRootAfter = str(dex._tradingHistoryTree._root)
    export.accountsMerkleRootAfter = str(dex._accountsTree._root)

    f = open("rings.json","w+")
    f.write(export.toJSON())
    f.close()

    # Create the proof
    subprocess.check_call(["build/circuit/dex_circuit", str(0), str(len(data["rings"])), "rings.json"])


    dex.saveState(dex_state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
