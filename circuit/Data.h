#ifndef _DATA_H_
#define _DATA_H_

#include "Constants.h"

#include "json.hpp"
#include "ethsnarks.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"

using json = nlohmann::json;


namespace Loopring
{

class Proof
{
public:
    std::vector<ethsnarks::FieldT> data;
};

void from_json(const json& j, Proof& proof)
{
    for(unsigned int i = 0; i < j.size(); i++)
    {
        proof.data.push_back(ethsnarks::FieldT(j[i].get<std::string>().c_str()));
    }
}

class TradeHistoryLeaf
{
public:
    ethsnarks::FieldT filled;
    ethsnarks::FieldT cancelled;
};

void from_json(const json& j, TradeHistoryLeaf& leaf)
{
    leaf.filled = ethsnarks::FieldT(j.at("filled").get<std::string>().c_str());
    leaf.cancelled = ethsnarks::FieldT(j.at("cancelled"));
}

class Account
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT dexID;
    ethsnarks::FieldT token;
    ethsnarks::FieldT balance;
};

void from_json(const json& j, Account& account)
{
    account.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    account.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    account.dexID = ethsnarks::FieldT(j.at("dexID"));
    account.token = ethsnarks::FieldT(j.at("token"));
    account.balance = ethsnarks::FieldT(j.at("balance"));
}

class TradeHistoryUpdate
{
public:
    TradeHistoryLeaf before;
    TradeHistoryLeaf after;
    Proof proof;
};

void from_json(const json& j, TradeHistoryUpdate& tradeHistoryUpdate)
{
    tradeHistoryUpdate.before = j.at("before").get<TradeHistoryLeaf>();
    tradeHistoryUpdate.after = j.at("after").get<TradeHistoryLeaf>();
    tradeHistoryUpdate.proof = j.at("proof").get<Proof>();
}

class BalanceUpdate
{
public:
    Account before;
    Account after;
    Proof proof;
};

void from_json(const json& j, BalanceUpdate& balanceUpdate)
{
    balanceUpdate.before = j.at("before").get<Account>();
    balanceUpdate.after = j.at("after").get<Account>();
    balanceUpdate.proof = j.at("proof").get<Proof>();
}

class Signature
{
public:
    ethsnarks::jubjub::EdwardsPoint R;
    ethsnarks::FieldT s;
};

void from_json(const json& j, Signature& signature)
{
    signature.R.x = ethsnarks::FieldT(j.at("sigRx").get<std::string>().c_str());
    signature.R.y = ethsnarks::FieldT(j.at("sigRy").get<std::string>().c_str());
    signature.s = ethsnarks::FieldT(j.at("sigS").get<std::string>().c_str());
}

class Order
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::jubjub::EdwardsPoint walletPublicKey;
    ethsnarks::FieldT dexID;
    ethsnarks::FieldT orderID;
    ethsnarks::FieldT accountS;
    ethsnarks::FieldT accountB;
    ethsnarks::FieldT accountF;
    ethsnarks::FieldT amountS;
    ethsnarks::FieldT amountB;
    ethsnarks::FieldT amountF;
    ethsnarks::FieldT tokenS;
    ethsnarks::FieldT tokenB;
    ethsnarks::FieldT tokenF;
    ethsnarks::FieldT walletF;
    Signature sig;
};

void from_json(const json& j, Order& order)
{
    order.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    order.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    order.walletPublicKey.x = ethsnarks::FieldT(j.at("walletPublicKeyX").get<std::string>().c_str());
    order.walletPublicKey.y = ethsnarks::FieldT(j.at("walletPublicKeyY").get<std::string>().c_str());
    order.dexID = ethsnarks::FieldT(j.at("dexID"));
    order.orderID = ethsnarks::FieldT(j.at("orderID"));
    order.accountS = ethsnarks::FieldT(j.at("accountS"));
    order.accountB = ethsnarks::FieldT(j.at("accountB"));
    order.accountF = ethsnarks::FieldT(j.at("accountF"));
    order.amountS = ethsnarks::FieldT(j.at("amountS"));
    order.amountB = ethsnarks::FieldT(j.at("amountB"));
    order.amountF = ethsnarks::FieldT(j.at("amountF"));
    order.tokenS = ethsnarks::FieldT(j.at("tokenS"));
    order.tokenB = ethsnarks::FieldT(j.at("tokenB"));
    order.tokenF = ethsnarks::FieldT(j.at("tokenF"));
    order.walletF = ethsnarks::FieldT(j.at("walletF"));
    order.sig = j.get<Signature>();
}

class Ring
{
public:
    Order orderA;
    Order orderB;
    ethsnarks::FieldT fillS_A;
    ethsnarks::FieldT fillB_A;
    ethsnarks::FieldT fillF_A;
    ethsnarks::FieldT fillS_B;
    ethsnarks::FieldT fillB_B;
    ethsnarks::FieldT fillF_B;
};

void from_json(const json& j, Ring& ring)
{
    ring.orderA = j.at("orderA").get<Order>();
    ring.orderB = j.at("orderB").get<Order>();
    ring.fillS_A = ethsnarks::FieldT(j.at("fillS_A"));
    ring.fillB_A = ethsnarks::FieldT(j.at("fillB_A"));
    ring.fillF_A = ethsnarks::FieldT(j.at("fillF_A"));
    ring.fillS_B = ethsnarks::FieldT(j.at("fillS_B"));
    ring.fillB_B = ethsnarks::FieldT(j.at("fillB_B"));
    ring.fillF_B = ethsnarks::FieldT(j.at("fillF_B"));
}

class RingSettlement
{
public:
    ethsnarks::FieldT tradingHistoryMerkleRoot;
    ethsnarks::FieldT accountsMerkleRoot;
    Ring ring;

    TradeHistoryUpdate tradeHistoryUpdate_A;
    TradeHistoryUpdate tradeHistoryUpdate_B;

    BalanceUpdate balanceUpdateS_A;
    BalanceUpdate balanceUpdateB_A;
    BalanceUpdate balanceUpdateF_A;
    BalanceUpdate balanceUpdateF_WA;

    BalanceUpdate balanceUpdateS_B;
    BalanceUpdate balanceUpdateB_B;
    BalanceUpdate balanceUpdateF_B;
    BalanceUpdate balanceUpdateF_WB;
};

void from_json(const json& j, RingSettlement& ringSettlement)
{
    ringSettlement.tradingHistoryMerkleRoot = ethsnarks::FieldT(j.at("tradingHistoryMerkleRoot").get<std::string>().c_str());
    ringSettlement.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());

    ringSettlement.ring = j.at("ring").get<Ring>();

    ringSettlement.tradeHistoryUpdate_A = j.at("tradeHistoryUpdate_A").get<TradeHistoryUpdate>();
    ringSettlement.tradeHistoryUpdate_B = j.at("tradeHistoryUpdate_B").get<TradeHistoryUpdate>();

    ringSettlement.balanceUpdateS_A = j.at("balanceUpdateS_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_A = j.at("balanceUpdateB_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_A = j.at("balanceUpdateF_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_WA = j.at("balanceUpdateF_WA").get<BalanceUpdate>();

    ringSettlement.balanceUpdateS_B = j.at("balanceUpdateS_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_B = j.at("balanceUpdateB_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_B = j.at("balanceUpdateF_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_WB = j.at("balanceUpdateF_WB").get<BalanceUpdate>();
}

class Deposit
{
public:
    ethsnarks::FieldT accountsMerkleRoot;
    ethsnarks::FieldT address;
    BalanceUpdate balanceUpdate;
};

void from_json(const json& j, Deposit& deposit)
{
    deposit.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());
    deposit.address = ethsnarks::FieldT(j.at("address"));
    deposit.balanceUpdate = j.at("balanceUpdate").get<BalanceUpdate>();
}

class Withdrawal
{
public:
    ethsnarks::FieldT accountsMerkleRoot;
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT account;
    ethsnarks::FieldT amount;
    BalanceUpdate balanceUpdate;
    Signature sig;
};

void from_json(const json& j, Withdrawal& withdrawal)
{
    withdrawal.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());
    withdrawal.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    withdrawal.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    withdrawal.account = ethsnarks::FieldT(j.at("account"));
    withdrawal.amount = ethsnarks::FieldT(j.at("amount"));
    withdrawal.balanceUpdate = j.at("balanceUpdate").get<BalanceUpdate>();
    withdrawal.sig = j.get<Signature>();
}

}

#endif
