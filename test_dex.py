import sys
import json
from dex import Dex, Order, Ring
from ethsnarks.eddsa import eddsa_random_keypair

class Export(object):
	def __init__(self):
		self.ringSettlements = []

	def toJSON(self):
		return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

def main():
	owner = "101010101010101010"
	tokenS = "123456789"
	tokenB = "987654321"
	tokenF = "159753456852"
	amountS = 100
	amountB = 200
	amountF = 1000

	(secretKeyA, publicKeyA) = eddsa_random_keypair()
	(secretKeyB, publicKeyB) = eddsa_random_keypair()

	orderA = Order(publicKeyA, owner, tokenS, tokenB, tokenF, amountS, amountB, amountF)
	orderA.sign(secretKeyA)

	orderB = Order(publicKeyB, owner, tokenB, tokenS, tokenF, amountB, amountS, amountF)
	orderB.sign(secretKeyB)

	dex = Dex()
	export = Export()
	for _ in range(128):
		ring = Ring(orderA, orderB, 1, 2, 10, 2, 1, 10)
		ringSettlement = dex.settleRing(ring)
		export.ringSettlements.append(ringSettlement)

	f = open("rings.json","w+")
	f.write(export.toJSON())
	f.close()

if __name__ == "__main__":
	sys.exit(main(*sys.argv[1:]))
