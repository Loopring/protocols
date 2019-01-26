import sys
sys.path.insert(0, 'ethsnarks')
import os.path
import json
from ethsnarks.eddsa import PureEdDSA

(secretKey, publicKey) = PureEdDSA.random_keypair()
pair = {
    "publicKeyX": str(publicKey.x),
    "publicKeyY": str(publicKey.y),
    "secretKey": str(secretKey),
}
f = open("EDDSA_KeyPair.json","w+")
f.write(json.dumps(pair, indent=4))
f.close()