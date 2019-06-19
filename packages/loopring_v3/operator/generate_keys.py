from create_block import *
import subprocess

class Struct(object): pass

def generateDepositKeys(blockSize, blockIdx):
    depositBlock = Struct()
    depositBlock.onchainDataAvailability = False
    depositBlock.startHash = "0"
    depositBlock.deposits = []
    depositBlock.startIndex = 0
    depositBlock.count = blockSize
    for i in range(blockSize):
        deposit = Struct()
        deposit.depositIdx = 0
        deposit.accountID = 0
        deposit.publicKeyX = "18237593964105116387404866573384914027689453008281590972000586479855593925572"
        deposit.publicKeyY = "20731851773435249210756325325794269788939923180526418562436264911769477477274"
        deposit.secretKey = "2241032725611854181086749742944128065257732576391743644741747359416215206761"
        deposit.tokenID = 0
        deposit.amount = 0
        depositBlock.deposits.append(deposit)

    blockJson = json.dumps(depositBlock, default=lambda o: o.__dict__, sort_keys=True, indent=4)
    # print("blockJson:", blockJson)

    inputFile = "./genkeys/block_deposit_info_" + str(depositBlock.count) + ".json"
    f = open(inputFile, "w+")
    f.write(blockJson)
    f.close()

    blockOutputFile = "./genkeys/block_deposit_" + str(depositBlock.count) + ".json"

    subprocess.check_call([
        "python3",
        "operator/create_block.py",
        "0",
        str(blockIdx),
        "1",
        inputFile,
        blockOutputFile
    ])

    subprocess.check_call(["build/circuit/dex_circuit", "-createkeys", blockOutputFile])

def generateWithdrawalKeys(size, onchainDataAvailability, blockIdx):
    withdrawalBlock = Struct()
    withdrawalBlock.onchainDataAvailability = onchainDataAvailability
    withdrawalBlock.operatorAccountID = 0
    withdrawalBlock.startHash = 0
    withdrawalBlock.startIndex = 0
    withdrawalBlock.count = size
    withdrawalBlock.withdrawals = []

    for i in range(size):
        withdrawReqeust = Struct()
        withdrawReqeust.accountID = 0
        withdrawReqeust.tokenID = 0
        withdrawReqeust.amount = 0
        withdrawReqeust.walletAccountID = 0
        withdrawReqeust.feeTokenID = 1
        withdrawReqeust.fee = 0
        withdrawReqeust.walletSplitPercentage = 0
        withdrawalBlock.withdrawals.append(withdrawReqeust)

    blockJson = json.dumps(withdrawalBlock, default=lambda o: o.__dict__, sort_keys=True, indent=4)
    inputFile = "./genkeys/block_withdrawal_info_" + str(withdrawalBlock.count) + ".json"
    f = open(inputFile, "w+")
    f.write(blockJson)
    f.close()

    blockOutputFile = "./genkeys/block_withdrawal_" + str(withdrawalBlock.count) + ".json"
    blockType = "2" if onchainDataAvailability else "3"
    realmBase = 2000 if onchainDataAvailability else 3000

    subprocess.check_call([
        "python3",
        "operator/create_block.py",
        "0",
        str(blockIdx),
        blockType,
        inputFile,
        blockOutputFile
    ])

    subprocess.check_call(["build/circuit/dex_circuit", "-createkeys", blockOutputFile])

def generateOnchainWithdrawalKeys(size, blockIdx):
    generateWithdrawalKeys(size, True, blockIdx)

def generateOffchainWithdrawalKeys(size, blockIdx):
    generateWithdrawalKeys(size, False, blockIdx)

def generateRingSettlementKeys(size, onchainDataAvailability, blockIdx):
    rsBlock = Struct()
    rsBlock.onchainDataAvailability = onchainDataAvailability
    rsBlock.timestamp = 0
    rsBlock.realmID = 0
    rsBlock.operatorAccountID = 0
    rsBlock.rings = []

    for i in range(size):
        ring = Struct()
        ring.minerAccountID = 10
        ring.feeRecipientAccountID = 11
        ring.tokenID = 0
        ring.fee = 0
        ring.orderA = Struct()
        ring.orderA.realmID = 0
        ring.orderA.orderID = 0
        ring.orderA.accountID = 20
        ring.orderA.walletAccountID = 21
        ring.orderA.dualAuthPublicKeyX = "18237593964105116387404866573384914027689453008281590972000586479855593925572"
        ring.orderA.dualAuthPublicKeyY = "20731851773435249210756325325794269788939923180526418562436264911769477477274"
        ring.orderA.dualAuthSecretKey = "2241032725611854181086749742944128065257732576391743644741747359416215206761"

        ring.orderA.tokenIdS = 0
        ring.orderA.tokenIdB = 1
        ring.orderA.tokenIdF = 0

        ring.orderA.allOrNone = False
        ring.orderA.validSince = 0
        ring.orderA.validUntil = 0
        ring.orderA.walletSplitPercentage = 0
        ring.orderA.waiveFeePercentage = 0

        ring.orderA.amountS = 1
        ring.orderA.amountB = 1
        ring.orderA.amountF = 1

        ring.orderB = Struct()
        ring.orderB.realmID = 0
        ring.orderB.orderID = 0
        ring.orderB.accountID = 30
        ring.orderB.walletAccountID = 31

        ring.orderB.dualAuthPublicKeyX = "18237593964105116387404866573384914027689453008281590972000586479855593925572"
        ring.orderB.dualAuthPublicKeyY = "20731851773435249210756325325794269788939923180526418562436264911769477477274"
        ring.orderB.dualAuthSecretKey = "2241032725611854181086749742944128065257732576391743644741747359416215206761"

        ring.orderB.tokenIdS = 1
        ring.orderB.tokenIdB = 0
        ring.orderB.tokenIdF = 0

        ring.orderB.allOrNone = False
        ring.orderB.validSince = 0
        ring.orderB.validUntil = 0
        ring.orderB.walletSplitPercentage = 0
        ring.orderB.waiveFeePercentage = 0

        ring.orderB.amountS = 1
        ring.orderB.amountB = 1
        ring.orderB.amountF = 1

        rsBlock.rings.append(ring)

    blockJson = json.dumps(rsBlock, default=lambda o: o.__dict__, sort_keys=True, indent=4)
    inputFile = "./genkeys/block_trade_info_" + str(rsBlock.count) + ".json"
    f = open(inputFile, "w+")
    f.write(blockJson)
    f.close()

    blockOutputFile = "./genkeys/block_trade_" + str(rsBlock.count) + ".json"
    blockType = "0"
    realmBase = 4000 if onchainDataAvailability else 5000

    subprocess.check_call([
        "python3",
        "operator/create_block.py",
        "0",
        str(blockIdx),
        blockType,
        inputFile,
        blockOutputFile
    ])

    subprocess.check_call(["build/circuit/dex_circuit", "-createkeys", blockOutputFile])

def generateRingSettlementKeysWithDA(size, blockIdx):
    generateRingSettlementKeys(size, True, blockIdx)

def generateRingSettlementKeysWithoutDA(size, blockIdx):
    generateRingSettlementKeys(size, False, blockIdx)

if __name__ == "__main__":
    # generate keys for blocks with length: [1-16, 32, 64, 96, 128]
    # size_arr = [*range(1, 17), 32, 64, 96, 128]
    size_arr = [4] # simple test

    blockIdx = 1
    for size in size_arr:
        generateDepositKeys(size, blockIdx)
        blockIdx += 1
        generateOnchainWithdrawalKeys(size, blockIdx)
        blockIdx += 1
        # generateOffchainWithdrawalKeys(size, blockIdx)
        # blockIdx += 1
