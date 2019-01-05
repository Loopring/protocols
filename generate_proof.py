import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'circuit')
import os.path
import subprocess
import json
from dex import Dex, Order, Ring
from ethsnarks.eddsa import eddsa_random_keypair


class Export(object):
    def __init__(self):
        self.ringSettlements = []
        self.merkleRootBefore = 0
        self.merkleRootAfter = 0

    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)


def orderFromJSON(jOrder):
    owner = str(int(jOrder["owner"], 16))
    tokenS = str(int(jOrder["tokenS"], 16))
    tokenB = str(int(jOrder["tokenB"], 16))
    tokenF = str(int(jOrder["tokenF"], 16))
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    amountF = int(jOrder["amountF"])

    (secretKeyA, publicKeyA) = eddsa_random_keypair()
    order = Order(publicKeyA, owner, tokenS, tokenB, tokenF, amountS, amountB, amountF)
    order.sign(secretKeyA)

    return order


def ringFromJSON(jRing):
    orderA = orderFromJSON(jRing["orderA"])
    orderB = orderFromJSON(jRing["orderB"])

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

    export = Export()
    export.merkleRootBefore = str(dex._tree._root)
    for ringInfo in data["rings"]:
        ring = ringFromJSON(ringInfo)
        ringSettlement = dex.settleRing(ring)
        export.ringSettlements.append(ringSettlement)
    export.merkleRootAfter = str(dex._tree._root)

    f = open("rings.json","w+")
    f.write(export.toJSON())
    f.close()

    # Create the proof
    subprocess.check_call(["build/circuit/dex_circuit", str(len(data["rings"])), "rings.json"])

    dex.saveState(dex_state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
