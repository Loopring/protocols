// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _DATA_H_
#define _DATA_H_

#include "Constants.h"

//#include "../ThirdParty/json.hpp"
#include "ethsnarks.hpp"
#include "jubjub/eddsa.hpp"
#include "jubjub/point.hpp"

using json = nlohmann::json;

namespace Loopring
{

static auto dummySpotTrade = R"({
    "fFillS_A": 0,
    "fFillS_B": 0,
    "orderA": {
        "accountID": 0,
        "amountB": "79228162514264337593543950335",
        "amountS": "79228162514264337593543950335",
        "fillAmountBorS": true,
        "feeBips": 0,
        "maxFeeBips": 0,
        "storageID": "0",
        "tokenS": 0,
        "tokenB": 1,
        "validUntil": 4294967295,
        "taker": "0",
        "amm": false
    },
    "orderB": {
        "accountID": 0,
        "amountB": "79228162514264337593543950335",
        "amountS": "79228162514264337593543950335",
        "fillAmountBorS": true,
        "feeBips": 0,
        "maxFeeBips": 0,
        "storageID": "0",
        "tokenS": 1,
        "tokenB": 0,
        "validUntil": 4294967295,
        "taker": "0",
        "amm": false
    }
})"_json;

static auto dummyTransfer = R"({
    "fromAccountID": 0,
    "toAccountID": 2,
    "amount": "0",
    "fee": "0",
    "feeTokenID": 0,
    "tokenID": 0,
    "validUntil": 4294967295,
    "maxFee": "0",
    "type": 0,
    "ownerFrom": "0",
    "to": "2",
    "dualAuthorX": "0",
    "dualAuthorY": "0",
    "data": "0",
    "payerToAccountID": 2,
    "payerTo": "2",
    "payeeToAccountID": 2,
    "storageID": "0",
    "putAddressesInDA": false
})"_json;

static auto dummyWithdraw = R"({
    "owner": "0",
    "accountID": 0,
    "tokenID": 0,
    "amount": "0",
    "feeTokenID": 0,
    "fee": "0",
    "validUntil": 4294967295,
    "maxFee": "0",
    "onchainDataHash": "0",
    "type": 0,
    "storageID": "0"
})"_json;

static auto dummyAccountUpdate = R"({
    "owner": "0",
    "accountID": 0,
    "validUntil": 4294967295,
    "publicKeyX": "0",
    "publicKeyY": "0",
    "feeTokenID": 0,
    "fee": "0",
    "maxFee": "0",
    "type": 0
})"_json;

static auto dummyDeposit = R"({
    "owner": "0",
    "accountID": 0,
    "tokenID": 0,
    "amount": "0"
})"_json;

static auto dummyAmmUpdate = R"({
    "accountID": 0,
    "tokenID": 0,
    "feeBips": 0,
    "tokenWeight": "0"
})"_json;

static auto dummySignatureVerification = R"({
    "accountID": 0,
    "data": "0"
})"_json;

// Baby Jubjub base point.
// https://github.com/ethereum/EIPs/blob/41569d75e42da2046cb18fdca79609e18968af47/eip-draft_babyjubjub.md#base-point
static auto dummySignature = R"({
    "Rx": "5299619240641551281634865583518297030282874472190772894086521144482721001553",
    "Ry": "16950150798460657717958625567821834550301663161624707787222815936182638968203",
    "s": "0"
})"_json;

enum class TransactionType
{
    Noop = 0,
    Deposit,
    Withdrawal,
    Transfer,
    SpotTrade,
    AccountUpdate,
    AmmUpdate,
    SignatureVerification,

    COUNT
};

class Proof
{
  public:
    std::vector<ethsnarks::FieldT> data;
};

static void from_json(const json &j, Proof &proof)
{
    for (unsigned int i = 0; i < j.size(); i++)
    {
        proof.data.push_back(ethsnarks::FieldT(j[i].get<std::string>().c_str()));
    }
}

class StorageLeaf
{
  public:
    ethsnarks::FieldT data;
    ethsnarks::FieldT storageID;
};

static void from_json(const json &j, StorageLeaf &leaf)
{
    leaf.data = ethsnarks::FieldT(j.at("data").get<std::string>().c_str());
    leaf.storageID = ethsnarks::FieldT(j.at("storageID").get<std::string>().c_str());
}

class BalanceLeaf
{
  public:
    ethsnarks::FieldT balance;
    ethsnarks::FieldT weightAMM;
    ethsnarks::FieldT storageRoot;
};

static void from_json(const json &j, BalanceLeaf &leaf)
{
    leaf.balance = ethsnarks::FieldT(j.at("balance").get<std::string>().c_str());
    leaf.weightAMM = ethsnarks::FieldT(j.at("weightAMM").get<std::string>().c_str());
    leaf.storageRoot = ethsnarks::FieldT(j.at("storageRoot").get<std::string>().c_str());
}

class AccountLeaf
{
  public:
    ethsnarks::FieldT owner;
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT nonce;
    ethsnarks::FieldT feeBipsAMM;
    ethsnarks::FieldT balancesRoot;
};

static void from_json(const json &j, AccountLeaf &account)
{
    account.owner = ethsnarks::FieldT(j.at("owner").get<std::string>().c_str());
    account.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    account.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    account.nonce = ethsnarks::FieldT(j.at("nonce"));
    account.feeBipsAMM = ethsnarks::FieldT(j.at("feeBipsAMM"));
    account.balancesRoot = ethsnarks::FieldT(j.at("balancesRoot").get<std::string>().c_str());
}

class BalanceUpdate
{
  public:
    ethsnarks::FieldT tokenID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    BalanceLeaf before;
    BalanceLeaf after;
};

static void from_json(const json &j, BalanceUpdate &balanceUpdate)
{
    balanceUpdate.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    balanceUpdate.proof = j.at("proof").get<Proof>();
    balanceUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    balanceUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    balanceUpdate.before = j.at("before").get<BalanceLeaf>();
    balanceUpdate.after = j.at("after").get<BalanceLeaf>();
}

class StorageUpdate
{
  public:
    ethsnarks::FieldT storageID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    StorageLeaf before;
    StorageLeaf after;
};

static void from_json(const json &j, StorageUpdate &storageUpdate)
{
    storageUpdate.storageID = ethsnarks::FieldT(j.at("storageID").get<std::string>().c_str());
    storageUpdate.proof = j.at("proof").get<Proof>();
    storageUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    storageUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    storageUpdate.before = j.at("before").get<StorageLeaf>();
    storageUpdate.after = j.at("after").get<StorageLeaf>();
}

class AccountUpdate
{
  public:
    ethsnarks::FieldT accountID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    AccountLeaf before;
    AccountLeaf after;
};

static void from_json(const json &j, AccountUpdate &accountUpdate)
{
    accountUpdate.accountID = ethsnarks::FieldT(j.at("accountID"));
    accountUpdate.proof = j.at("proof").get<Proof>();
    accountUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    accountUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    accountUpdate.before = j.at("before").get<AccountLeaf>();
    accountUpdate.after = j.at("after").get<AccountLeaf>();
}

class Signature
{
  public:
    Signature()
    {
    }

    Signature(ethsnarks::jubjub::EdwardsPoint _R, ethsnarks::FieldT _s) : R(_R), s(_s)
    {
    }

    ethsnarks::jubjub::EdwardsPoint R;
    ethsnarks::FieldT s;
};

static void from_json(const json &j, Signature &signature)
{
    signature.R.x = ethsnarks::FieldT(j.at("Rx").get<std::string>().c_str());
    signature.R.y = ethsnarks::FieldT(j.at("Ry").get<std::string>().c_str());
    signature.s = ethsnarks::FieldT(j.at("s").get<std::string>().c_str());
}

class Order
{
  public:
    ethsnarks::FieldT storageID;
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT tokenS;
    ethsnarks::FieldT tokenB;
    ethsnarks::FieldT amountS;
    ethsnarks::FieldT amountB;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT maxFeeBips;
    ethsnarks::FieldT fillAmountBorS;
    ethsnarks::FieldT taker;

    ethsnarks::FieldT feeBips;

    ethsnarks::FieldT amm;
};

static void from_json(const json &j, Order &order)
{
    order.storageID = ethsnarks::FieldT(j.at("storageID").get<std::string>().c_str());
    order.accountID = ethsnarks::FieldT(j.at("accountID"));
    order.tokenS = ethsnarks::FieldT(j.at("tokenS"));
    order.tokenB = ethsnarks::FieldT(j.at("tokenB"));
    order.amountS = ethsnarks::FieldT(j.at("amountS").get<std::string>().c_str());
    order.amountB = ethsnarks::FieldT(j.at("amountB").get<std::string>().c_str());
    order.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    order.maxFeeBips = ethsnarks::FieldT(j.at("maxFeeBips"));
    order.fillAmountBorS = ethsnarks::FieldT(j.at("fillAmountBorS").get<bool>() ? 1 : 0);
    order.taker = ethsnarks::FieldT(j.at("taker").get<std::string>().c_str());

    order.feeBips = ethsnarks::FieldT(j.at("feeBips"));

    order.amm = ethsnarks::FieldT(j.at("amm").get<bool>() ? 1 : 0);
}

class SpotTrade
{
  public:
    Order orderA;
    Order orderB;
    ethsnarks::FieldT fillS_A;
    ethsnarks::FieldT fillS_B;
};

static void from_json(const json &j, SpotTrade &spotTrade)
{
    spotTrade.orderA = j.at("orderA").get<Order>();
    spotTrade.orderB = j.at("orderB").get<Order>();
    spotTrade.fillS_A = ethsnarks::FieldT(j["fFillS_A"]);
    spotTrade.fillS_B = ethsnarks::FieldT(j["fFillS_B"]);
}

class Deposit
{
  public:
    ethsnarks::FieldT owner;
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT tokenID;
    ethsnarks::FieldT amount;
};

static void from_json(const json &j, Deposit &deposit)
{
    deposit.owner = ethsnarks::FieldT(j.at("owner").get<std::string>().c_str());
    deposit.accountID = ethsnarks::FieldT(j.at("accountID"));
    deposit.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    deposit.amount = ethsnarks::FieldT(j.at("amount").get<std::string>().c_str());
}

class Withdrawal
{
  public:
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT tokenID;
    ethsnarks::FieldT amount;
    ethsnarks::FieldT feeTokenID;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT onchainDataHash;
    ethsnarks::FieldT storageID;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT maxFee;
    ethsnarks::FieldT type;
};

static void from_json(const json &j, Withdrawal &withdrawal)
{
    withdrawal.accountID = ethsnarks::FieldT(j.at("accountID"));
    withdrawal.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    withdrawal.amount = ethsnarks::FieldT(j["amount"].get<std::string>().c_str());
    withdrawal.feeTokenID = ethsnarks::FieldT(j.at("feeTokenID"));
    withdrawal.fee = ethsnarks::FieldT(j["fee"].get<std::string>().c_str());
    withdrawal.onchainDataHash = ethsnarks::FieldT(j["onchainDataHash"].get<std::string>().c_str());
    withdrawal.storageID = ethsnarks::FieldT(j["storageID"].get<std::string>().c_str());
    withdrawal.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    withdrawal.maxFee = ethsnarks::FieldT(j["maxFee"].get<std::string>().c_str());
    withdrawal.type = ethsnarks::FieldT(j.at("type"));
}

class AccountUpdateTx
{
  public:
    ethsnarks::FieldT owner;
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT publicKeyX;
    ethsnarks::FieldT publicKeyY;
    ethsnarks::FieldT feeTokenID;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT maxFee;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT type;
};

static void from_json(const json &j, AccountUpdateTx &update)
{
    update.owner = ethsnarks::FieldT(j.at("owner").get<std::string>().c_str());
    update.accountID = ethsnarks::FieldT(j.at("accountID"));
    update.publicKeyX = ethsnarks::FieldT(j["publicKeyX"].get<std::string>().c_str());
    update.publicKeyY = ethsnarks::FieldT(j["publicKeyY"].get<std::string>().c_str());
    update.feeTokenID = ethsnarks::FieldT(j.at("feeTokenID"));
    update.fee = ethsnarks::FieldT(j["fee"].get<std::string>().c_str());
    update.maxFee = ethsnarks::FieldT(j["maxFee"].get<std::string>().c_str());
    update.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    update.type = ethsnarks::FieldT(j.at("type"));
}

class AmmUpdate
{
  public:
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT tokenID;
    ethsnarks::FieldT feeBips;
    ethsnarks::FieldT tokenWeight;
};

static void from_json(const json &j, AmmUpdate &update)
{
    update.accountID = ethsnarks::FieldT(j.at("accountID"));
    update.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    update.feeBips = ethsnarks::FieldT(j.at("feeBips"));
    update.tokenWeight = ethsnarks::FieldT(j.at("tokenWeight").get<std::string>().c_str());
}

class SignatureVerification
{
  public:
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT data;
};

static void from_json(const json &j, SignatureVerification &verification)
{
    verification.accountID = ethsnarks::FieldT(j.at("accountID"));
    verification.data = ethsnarks::FieldT(j.at("data").get<std::string>().c_str());
}

class Transfer
{
  public:
    ethsnarks::FieldT fromAccountID;
    ethsnarks::FieldT toAccountID;
    ethsnarks::FieldT tokenID;
    ethsnarks::FieldT amount;
    ethsnarks::FieldT feeTokenID;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT to;
    ethsnarks::FieldT dualAuthorX;
    ethsnarks::FieldT dualAuthorY;
    ethsnarks::FieldT storageID;
    ethsnarks::FieldT payerToAccountID;
    ethsnarks::FieldT payerTo;
    ethsnarks::FieldT payeeToAccountID;
    ethsnarks::FieldT maxFee;
    ethsnarks::FieldT putAddressesInDA;
    ethsnarks::FieldT type;
};

static void from_json(const json &j, Transfer &transfer)
{
    transfer.fromAccountID = ethsnarks::FieldT(j.at("fromAccountID"));
    transfer.toAccountID = ethsnarks::FieldT(j.at("toAccountID"));
    transfer.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    transfer.amount = ethsnarks::FieldT(j["amount"].get<std::string>().c_str());
    transfer.feeTokenID = ethsnarks::FieldT(j.at("feeTokenID"));
    transfer.fee = ethsnarks::FieldT(j["fee"].get<std::string>().c_str());
    transfer.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    transfer.to = ethsnarks::FieldT(j["to"].get<std::string>().c_str());
    transfer.dualAuthorX = ethsnarks::FieldT(j["dualAuthorX"].get<std::string>().c_str());
    transfer.dualAuthorY = ethsnarks::FieldT(j["dualAuthorY"].get<std::string>().c_str());
    transfer.storageID = ethsnarks::FieldT(j["storageID"].get<std::string>().c_str());
    transfer.payerToAccountID = ethsnarks::FieldT(j.at("payerToAccountID"));
    transfer.payerTo = ethsnarks::FieldT(j["payerTo"].get<std::string>().c_str());
    transfer.payeeToAccountID = ethsnarks::FieldT(j.at("payeeToAccountID"));
    transfer.maxFee = ethsnarks::FieldT(j["maxFee"].get<std::string>().c_str());
    transfer.putAddressesInDA = ethsnarks::FieldT(j.at("putAddressesInDA").get<bool>() ? 1 : 0);
    transfer.type = ethsnarks::FieldT(j.at("type"));
}

class Witness
{
  public:
    StorageUpdate storageUpdate_A;
    StorageUpdate storageUpdate_B;

    BalanceUpdate balanceUpdateS_A;
    BalanceUpdate balanceUpdateB_A;
    AccountUpdate accountUpdate_A;

    BalanceUpdate balanceUpdateS_B;
    BalanceUpdate balanceUpdateB_B;
    AccountUpdate accountUpdate_B;

    BalanceUpdate balanceUpdateA_O;
    BalanceUpdate balanceUpdateB_O;
    AccountUpdate accountUpdate_O;

    BalanceUpdate balanceUpdateA_P;
    BalanceUpdate balanceUpdateB_P;

    Signature signatureA;
    Signature signatureB;

    ethsnarks::FieldT numConditionalTransactionsAfter;
};

static void from_json(const json &j, Witness &state)
{
    state.storageUpdate_A = j.at("storageUpdate_A").get<StorageUpdate>();
    state.storageUpdate_B = j.at("storageUpdate_B").get<StorageUpdate>();

    state.balanceUpdateS_A = j.at("balanceUpdateS_A").get<BalanceUpdate>();
    state.balanceUpdateB_A = j.at("balanceUpdateB_A").get<BalanceUpdate>();
    state.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();

    state.balanceUpdateS_B = j.at("balanceUpdateS_B").get<BalanceUpdate>();
    state.balanceUpdateB_B = j.at("balanceUpdateB_B").get<BalanceUpdate>();
    state.accountUpdate_B = j.at("accountUpdate_B").get<AccountUpdate>();

    state.balanceUpdateA_O = j.at("balanceUpdateA_O").get<BalanceUpdate>();
    state.balanceUpdateB_O = j.at("balanceUpdateB_O").get<BalanceUpdate>();
    state.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    state.balanceUpdateA_P = j.at("balanceUpdateA_P").get<BalanceUpdate>();
    state.balanceUpdateB_P = j.at("balanceUpdateB_P").get<BalanceUpdate>();

    state.signatureA = dummySignature.get<Signature>();
    state.signatureB = dummySignature.get<Signature>();

    state.numConditionalTransactionsAfter = ethsnarks::FieldT(j.at("numConditionalTransactionsAfter"));

    if (j.contains("signatureA"))
    {
        state.signatureA = j.at("signatureA").get<Signature>();
    }
    if (j.contains("signatureB"))
    {
        state.signatureB = j.at("signatureB").get<Signature>();
    }
    else
    {
        state.signatureB = state.signatureA;
    }
}

class UniversalTransaction
{
  public:
    Witness witness;
    ethsnarks::FieldT type;
    SpotTrade spotTrade;
    Transfer transfer;
    Withdrawal withdraw;
    Deposit deposit;
    AccountUpdateTx accountUpdate;
    AmmUpdate ammUpdate;
    SignatureVerification signatureVerification;
};

static void from_json(const json &j, UniversalTransaction &transaction)
{
    transaction.witness = j.at("witness").get<Witness>();

    // Fill in dummy data for all tx types
    transaction.spotTrade = dummySpotTrade.get<Loopring::SpotTrade>();
    transaction.transfer = dummyTransfer.get<Loopring::Transfer>();
    transaction.withdraw = dummyWithdraw.get<Loopring::Withdrawal>();
    transaction.deposit = dummyDeposit.get<Loopring::Deposit>();
    transaction.accountUpdate = dummyAccountUpdate.get<Loopring::AccountUpdateTx>();
    transaction.ammUpdate = dummyAmmUpdate.get<Loopring::AmmUpdate>();
    transaction.signatureVerification = dummySignatureVerification.get<Loopring::SignatureVerification>();

    // Patch some of the dummy tx's so they are valid against the current state
    // Deposit
    transaction.deposit.owner = transaction.witness.accountUpdate_A.before.owner;
    // AccountUpdate
    transaction.accountUpdate.owner = transaction.witness.accountUpdate_A.before.owner;
    // Transfer
    transaction.transfer.to = transaction.witness.accountUpdate_B.before.owner;
    transaction.transfer.payerTo = transaction.witness.accountUpdate_B.before.owner;

    // Now get the actual transaction data for the actual transaction that will
    // execute from the block
    if (j.contains("noop"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::Noop));
    }
    if (j.contains("spotTrade"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::SpotTrade));
        transaction.spotTrade = j.at("spotTrade").get<Loopring::SpotTrade>();
    }
    else if (j.contains("transfer"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::Transfer));
        transaction.transfer = j.at("transfer").get<Loopring::Transfer>();
    }
    else if (j.contains("withdraw"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::Withdrawal));
        transaction.withdraw = j.at("withdraw").get<Loopring::Withdrawal>();
    }
    else if (j.contains("deposit"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::Deposit));
        transaction.deposit = j.at("deposit").get<Loopring::Deposit>();
    }
    else if (j.contains("accountUpdate"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::AccountUpdate));
        transaction.accountUpdate = j.at("accountUpdate").get<Loopring::AccountUpdateTx>();
    }
    else if (j.contains("ammUpdate"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::AmmUpdate));
        transaction.ammUpdate = j.at("ammUpdate").get<Loopring::AmmUpdate>();
    }
    else if (j.contains("signatureVerification"))
    {
        transaction.type = ethsnarks::FieldT(int(Loopring::TransactionType::SignatureVerification));
        transaction.signatureVerification = j.at("signatureVerification").get<Loopring::SignatureVerification>();
    }
}

class Block
{
  public:
    ethsnarks::FieldT exchange;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT timestamp;

    ethsnarks::FieldT protocolTakerFeeBips;
    ethsnarks::FieldT protocolMakerFeeBips;

    Signature signature;

    AccountUpdate accountUpdate_P;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::UniversalTransaction> transactions;
};

static void from_json(const json &j, Block &block)
{
    block.exchange = ethsnarks::FieldT(j["exchange"].get<std::string>().c_str());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.timestamp = ethsnarks::FieldT(j["timestamp"].get<unsigned int>());

    block.protocolTakerFeeBips = ethsnarks::FieldT(j["protocolTakerFeeBips"].get<unsigned int>());
    block.protocolMakerFeeBips = ethsnarks::FieldT(j["protocolMakerFeeBips"].get<unsigned int>());

    block.signature = j.at("signature").get<Signature>();

    block.accountUpdate_P = j.at("accountUpdate_P").get<AccountUpdate>();

    block.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    block.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read transactions
    json jTransactions = j["transactions"];
    for (unsigned int i = 0; i < jTransactions.size(); i++)
    {
        block.transactions.emplace_back(jTransactions[i].get<Loopring::UniversalTransaction>());
    }
}

} // namespace Loopring

#endif
