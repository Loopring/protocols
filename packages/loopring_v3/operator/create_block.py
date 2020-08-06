import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
import subprocess
import json
import pathlib
from state import Account, Context, State, Order, Ring, copyAccountInfo, AccountUpdateData


class Block(object):
    def __init__(self):
        self.blockType = 0
        self.transactions = []

    def toJSON(self):
        self.blockSize = len(self.transactions)
        data = json.dumps(self, default=lambda o: o.__dict__, sort_keys=False, indent=4)
        # Work around the reserved keyword "from" in python
        data = data.replace('"from_"','"from"')
        return data

class GeneralObject(object):
    pass


def orderFromJSON(jOrder, state):
    storageID = int(jOrder["storageID"])
    accountID = int(jOrder["accountID"])
    tokenS = int(jOrder["tokenIdS"])
    tokenB = int(jOrder["tokenIdB"])
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    validUntil = int(jOrder["validUntil"])
    buy = int(jOrder["buy"])
    taker = str(jOrder["taker"])
    maxFeeBips = int(jOrder["maxFeeBips"])

    feeBips = int(jOrder["feeBips"])

    account = state.getAccount(accountID)

    order = Order(account.publicKeyX, account.publicKeyY,
                  storageID, accountID,
                  tokenS, tokenB,
                  amountS, amountB,
                  validUntil, buy, taker,
                  maxFeeBips, feeBips)

    order.signature = jOrder["signature"]

    return order

def transferFromJSON(jTransfer):
    transfer = GeneralObject()
    transfer.fromAccountID = int(jTransfer["fromAccountID"])
    transfer.toAccountID = int(jTransfer["toAccountID"])
    transfer.tokenID = int(jTransfer["tokenID"])
    transfer.amount = str(jTransfer["amount"])
    transfer.feeTokenID = int(jTransfer["feeTokenID"])
    transfer.fee = str(jTransfer["fee"])
    transfer.type = int(jTransfer["type"])
    transfer.storageID = str(jTransfer["storageID"])
    transfer.from_ = str(jTransfer["from"])
    transfer.to = str(jTransfer["to"])
    transfer.validUntil = int(jTransfer["validUntil"])
    transfer.dualAuthorX = str(jTransfer["dualAuthorX"])
    transfer.dualAuthorY = str(jTransfer["dualAuthorY"])
    transfer.payerToAccountID = int(jTransfer["payerToAccountID"])
    transfer.payerTo = str(jTransfer["payerTo"])
    transfer.payeeToAccountID = int(jTransfer["payeeToAccountID"])
    transfer.signature = None
    transfer.dualSignature = None
    transfer.onchainSignature = None
    if "signature" in jTransfer:
        transfer.signature = jTransfer["signature"]
    if "dualSignature" in jTransfer:
        transfer.dualSignature = jTransfer["dualSignature"]
    return transfer

def withdrawFromJSON(jWithdraw):
    withdraw = GeneralObject()
    withdraw.owner = str(jWithdraw["owner"])
    withdraw.accountID = int(jWithdraw["accountID"])
    withdraw.nonce = str(jWithdraw["nonce"])
    withdraw.tokenID = int(jWithdraw["tokenID"])
    withdraw.amount = str(jWithdraw["amount"])
    withdraw.feeTokenID = int(jWithdraw["feeTokenID"])
    withdraw.fee = str(jWithdraw["fee"])
    withdraw.onchainDataHash = str(jWithdraw["onchainDataHash"])
    withdraw.type = int(jWithdraw["type"])
    withdraw.validUntil = int(jWithdraw["validUntil"])
    withdraw.signature = None
    if "signature" in jWithdraw:
        withdraw.signature = jWithdraw["signature"]
    return withdraw

def depositFromJSON(jDeposit):
    deposit = GeneralObject()
    deposit.owner = str(jDeposit["owner"])
    deposit.accountID = int(jDeposit["accountID"])
    deposit.tokenID = int(jDeposit["tokenID"])
    deposit.amount = str(jDeposit["amount"])
    return deposit


def accountUpdateFromJSON(jUpdate):
    update = GeneralObject()
    update.owner = str(jUpdate["owner"])
    update.accountID = int(jUpdate["accountID"])
    update.nonce = str(jUpdate["nonce"])
    update.validUntil = int(jUpdate["validUntil"])
    update.publicKeyX = str(jUpdate["publicKeyX"])
    update.publicKeyY = str(jUpdate["publicKeyY"])
    update.feeTokenID = int(jUpdate["feeTokenID"])
    update.fee = str(jUpdate["fee"])
    update.type = int(jUpdate["type"])
    update.signature = None
    if "signature" in jUpdate:
        update.signature = jUpdate["signature"]
    return update

def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)

    ring = Ring(orderA, orderB)

    return ring

def createBlock(state, data):
    block = Block()
    block.exchange = str(data["exchange"])
    block.merkleRootBefore = str(state.getRoot())
    block.timestamp = int(data["timestamp"])
    block.protocolTakerFeeBips = int(data["protocolTakerFeeBips"])
    block.protocolMakerFeeBips = int(data["protocolMakerFeeBips"])
    block.operatorAccountID = int(data["operatorAccountID"])

    context = Context(block.operatorAccountID, block.timestamp, block.protocolTakerFeeBips, block.protocolMakerFeeBips)

    # Protocol fee payment / index
    accountBefore_P = copyAccountInfo(state.getAccount(0))
    accountBefore_I = copyAccountInfo(state.getAccount(1))

    for transactionInfo in data["transactions"]:
        txType = transactionInfo["txType"]
        if txType == "Noop":
            transaction = GeneralObject()
        if txType == "SpotTrade":
            transaction = ringFromJSON(transactionInfo, state)
        if txType == "Transfer":
            transaction = transferFromJSON(transactionInfo)
        if txType == "Withdraw":
            transaction = withdrawFromJSON(transactionInfo)
        if txType == "Deposit":
            transaction = depositFromJSON(transactionInfo)
        if txType == "AccountUpdate":
            transaction = accountUpdateFromJSON(transactionInfo)

        transaction.txType = txType
        tx = state.executeTransaction(context, transaction)
        txWitness = GeneralObject()
        txWitness.witness = tx.witness
        if txType == "Noop":
            txWitness.noop = tx.input
        if txType == "SpotTrade":
            txWitness.spotTrade = tx.input
        if txType == "Transfer":
            txWitness.transfer = tx.input
        if txType == "Withdraw":
            txWitness.withdraw = tx.input
        if txType == "Deposit":
            txWitness.deposit = tx.input
        if txType == "AccountUpdate":
            txWitness.accountUpdate = tx.input
        txWitness.witness.numConditionalTransactionsAfter = context.numConditionalTransactions
        block.transactions.append(txWitness)

    # Protocol fees
    rootBefore = state._accountsTree._root
    proof = state._accountsTree.createProof(0)
    state.updateAccountTree(0)
    accountAfter = copyAccountInfo(state.getAccount(0))
    rootAfter = state._accountsTree._root
    block.accountUpdate_P = AccountUpdateData(0, proof, rootBefore, rootAfter, accountBefore_P, accountAfter)

    # Index
    rootBefore = state._accountsTree._root
    proof = state._accountsTree.createProof(1)
    state.updateAccountTree(1)
    accountAfter = copyAccountInfo(state.getAccount(1))
    rootAfter = state._accountsTree._root
    block.accountUpdate_I = AccountUpdateData(1, proof, rootBefore, rootAfter, accountBefore_I, accountAfter)

    # Operator
    account = state.getAccount(context.operatorAccountID)
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(context.operatorAccountID))
    proof = state._accountsTree.createProof(context.operatorAccountID)
    account.nonce += 1
    state.updateAccountTree(context.operatorAccountID)
    accountAfter = copyAccountInfo(state.getAccount(context.operatorAccountID))
    rootAfter = state._accountsTree._root
    block.accountUpdate_O = AccountUpdateData(context.operatorAccountID, proof, rootBefore, rootAfter, accountBefore, accountAfter)

    block.merkleRootAfter = str(state.getRoot())
    return block

def main(exchangeID, blockIdx, blockType, inputFilename, outputFilename):
    previousBlockIdx = int(blockIdx) - 1
    previous_state_filename = "./states/state_" + str(exchangeID) + "_" + str(previousBlockIdx) + ".json"

    state = State(exchangeID)
    if os.path.exists(previous_state_filename):
        state.load(previous_state_filename)

    with open(inputFilename) as f:
        data = json.load(f)

    block = createBlock(state, data)

    f = open(outputFilename,"w+")
    f.write(block.toJSON())
    f.close()

    pathlib.Path("./states").mkdir(parents=True, exist_ok=True)
    state_filename = "./states/state_" + str(exchangeID) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
