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


class Export(object):
    def __init__(self):
        self.ringSettlements = []
        self.tradingHistoryMerkleRootBefore = 0
        self.tradingHistoryMerkleRootAfter = 0
        self.accountsMerkleRootBefore = 0
        self.accountsMerkleRootAfter = 0

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

    account = dex.getAccount(accountS)
    order = Order(Point(account.publicKeyX, account.publicKeyY),
                  dexID, orderID,
                  accountS, accountB, accountF,
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

    (secretKeyW, publicKeyW) = eddsa_random_keypair()

    (secretKeyA, publicKeyA) = eddsa_random_keypair()
    dex.addAccount(Account(secretKeyA, publicKeyA, 0, 1, 100))
    dex.addAccount(Account(secretKeyA, publicKeyA, 0, 2, 100))
    dex.addAccount(Account(secretKeyA, publicKeyA, 0, 3, 100))

    (secretKeyB, publicKeyB) = eddsa_random_keypair()
    dex.addAccount(Account(secretKeyB, publicKeyB, 0, 1, 100))
    dex.addAccount(Account(secretKeyB, publicKeyB, 0, 2, 100))
    dex.addAccount(Account(secretKeyB, publicKeyB, 0, 3, 100))

    dex.addAccount(Account(secretKeyW, publicKeyW, 0, 3, 100))


    export = Export()
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
    subprocess.check_call(["build/circuit/dex_circuit", str(len(data["rings"])), "rings.json"])

    dex.saveState(dex_state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
