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
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

class GeneralObject(object):
    pass


def orderFromJSON(jOrder, state):
    exchangeID = int(jOrder["exchangeID"])
    orderID = int(jOrder["orderID"])
    accountID = int(jOrder["accountID"])
    tokenS = int(jOrder["tokenIdS"])
    tokenB = int(jOrder["tokenIdB"])
    amountS = int(jOrder["amountS"])
    amountB = int(jOrder["amountB"])
    allOrNone = int(jOrder["allOrNone"])
    validSince = int(jOrder["validSince"])
    validUntil = int(jOrder["validUntil"])
    buy = int(jOrder["buy"])
    maxFeeBips = int(jOrder["maxFeeBips"])

    feeBips = int(jOrder["feeBips"])
    rebateBips = int(jOrder["rebateBips"])

    #transferAmountTrade = int(jOrder["transferAmountTrade"])
    #reduceOnly = int(jOrder["reduceOnly"])
    #triggerPrice = int(jOrder["triggerPrice"])

    #transferAmount = int(jOrder["transferAmount"])
    #transferFee = int(jOrder["transferFee"])

    transferAmountTrade = int(0)
    reduceOnly = int(0)
    triggerPrice = int(0)

    transferAmount = int(0)
    transferFee = int(0)

    account = state.getAccount(accountID)

    order = Order(account.publicKeyX, account.publicKeyY,
                  exchangeID, orderID, accountID,
                  tokenS, tokenB,
                  amountS, amountB,
                  allOrNone, validSince, validUntil, buy,
                  maxFeeBips, feeBips, rebateBips,
                  transferAmountTrade, reduceOnly, triggerPrice,
                  transferAmount, transferFee)

    order.signature = jOrder["signature"]

    return order

def transferFromJSON(jTransfer):
    transfer = GeneralObject()
    transfer.accountFromID = int(jTransfer["accountFromID"])
    transfer.accountToID = int(jTransfer["accountToID"])
    transfer.transTokenID = int(jTransfer["transTokenID"])
    transfer.amount = str(jTransfer["amount"])
    transfer.feeTokenID = int(jTransfer["feeTokenID"])
    transfer.fee = str(jTransfer["fee"])
    transfer.type = int(jTransfer["type"])
    transfer.nonce = int(jTransfer["nonce"])
    transfer.ownerFrom = str(jTransfer["ownerFrom"])
    transfer.ownerTo = str(jTransfer["ownerTo"])
    transfer.signature = jTransfer["signature"]
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
    withdraw.type = int(jWithdraw["type"])
    withdraw.signature = jWithdraw["signature"]
    return withdraw

def depositFromJSON(jDeposit):
    deposit = GeneralObject()
    deposit.owner = str(jDeposit["owner"])
    deposit.accountID = int(jDeposit["accountID"])
    deposit.tokenID = int(jDeposit["tokenID"])
    deposit.amount = str(jDeposit["amount"])
    return deposit


def publicKeyUpdateFromJSON(jUpdate):
    update = GeneralObject()
    update.owner = str(jUpdate["owner"])
    update.accountID = int(jUpdate["accountID"])
    update.nonce = str(jUpdate["nonce"])
    update.publicKeyX = str(jUpdate["publicKeyX"])
    update.publicKeyY = str(jUpdate["publicKeyY"])
    update.feeTokenID = int(jUpdate["feeTokenID"])
    update.fee = str(jUpdate["fee"])
    update.onchainSignature = str(jUpdate["onchainSignature"])
    return update

def ringFromJSON(jRing, state):
    orderA = orderFromJSON(jRing["orderA"], state)
    orderB = orderFromJSON(jRing["orderB"], state)

    ring = Ring(orderA, orderB)

    return ring

def createBlock(state, data):
    block = Block()
    block.onchainDataAvailability = data["onchainDataAvailability"]
    block.exchangeID = state.exchangeID
    block.merkleRootBefore = str(state.getRoot())
    block.timestamp = int(data["timestamp"])
    block.protocolTakerFeeBips = int(data["protocolTakerFeeBips"])
    block.protocolMakerFeeBips = int(data["protocolMakerFeeBips"])
    block.operatorAccountID = int(data["operatorAccountID"])

    context = Context(block.operatorAccountID, block.timestamp, block.protocolTakerFeeBips, block.protocolMakerFeeBips)

    # Protocol fee payment / Operator payment
    accountBefore_P = copyAccountInfo(state.getAccount(0))

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
        if txType == "PublicKeyUpdate":
            transaction = publicKeyUpdateFromJSON(transactionInfo)

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
        if txType == "PublicKeyUpdate":
            txWitness.publicKeyUpdate = tx.input
        txWitness.witness.numConditionalTransactionsAfter = context.numConditionalTransactions
        block.transactions.append(txWitness)

    # Protocol fee payment
    rootBefore = state._accountsTree._root
    proof = state._accountsTree.createProof(0)
    state.updateAccountTree(0)
    accountAfter = copyAccountInfo(state.getAccount(0))
    rootAfter = state._accountsTree._root
    block.accountUpdate_P = AccountUpdateData(0, proof, rootBefore, rootAfter, accountBefore_P, accountAfter)

    # Operator payments
    account = state.getAccount(context.operatorAccountID)
    rootBefore = state._accountsTree._root
    accountBefore = copyAccountInfo(state.getAccount(context.operatorAccountID))
    proof = state._accountsTree.createProof(context.operatorAccountID)
    for tx in block.transactions:
        tx.witness.balanceUpdateA_O = account.updateBalance(tx.witness.balanceO_A_Address, tx.witness.balanceDeltaA_O)
        tx.witness.balanceUpdateB_O = account.updateBalance(tx.witness.balanceO_B_Address, tx.witness.balanceDeltaB_O)
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

    #blockType = data["blockType"]

    block = createBlock(state, data)

    f = open(outputFilename,"w+")
    f.write(block.toJSON())
    f.close()

    # Validate the block
    # subprocess.check_call(["build/circuit/dex_circuit", "-validate", outputFilename])

    pathlib.Path("./states").mkdir(parents=True, exist_ok=True)
    state_filename = "./states/state_" + str(exchangeID) + "_" + str(blockIdx) + ".json"
    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
