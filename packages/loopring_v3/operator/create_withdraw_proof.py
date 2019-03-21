import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
import subprocess
import json
from state import Account, Context, State, Order, Ring, copyAccountInfo, AccountUpdateData
from ethsnarks.jubjub import Point
from ethsnarks.field import FQ

class Export(object):
    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

def main(stateId, accountId, tokenId, outputFilename):
    state_filename = "state_" + str(stateId) + ".json"

    state = State(stateId)
    if os.path.exists(state_filename):
        state.load(state_filename)

    proof = state.createWithdrawProof(int(stateId), int(accountId), int(tokenId))

    export = Export()
    export.proof = proof

    f = open(outputFilename,"w+")
    f.write(export.toJSON())
    f.close()


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
