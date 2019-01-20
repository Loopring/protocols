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

    ethsnarks::FieldT filledA;
    ethsnarks::FieldT filledB;

    Proof proofFilledA;
    Proof proofFilledB;

    Account accountS_A_before;
    Account accountS_A_after;
    Proof accountS_A_proof;

    Account accountB_B_before;
    Account accountB_B_after;
    Proof accountB_B_proof;
};

void from_json(const json& j, RingSettlement& ringSettlement)
{
    ringSettlement.tradingHistoryMerkleRoot = ethsnarks::FieldT(j.at("tradingHistoryMerkleRoot").get<std::string>().c_str());
    ringSettlement.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());

    ringSettlement.ring = j.at("ring").get<Ring>();

    ringSettlement.filledA = ethsnarks::FieldT(j.at("filledA"));
    ringSettlement.filledB = ethsnarks::FieldT(j.at("filledB"));

    ringSettlement.proofFilledA = j.at("proofA").get<Proof>();
    ringSettlement.proofFilledB = j.at("proofB").get<Proof>();

    ringSettlement.accountS_A_before = j.at("accountS_A_before").get<Account>();
    ringSettlement.accountS_A_after = j.at("accountS_A_after").get<Account>();
    ringSettlement.accountS_A_proof = j.at("accountS_A_proof").get<Proof>();

    ringSettlement.accountB_B_before = j.at("accountB_B_before").get<Account>();
    ringSettlement.accountB_B_after = j.at("accountB_B_after").get<Account>();
    ringSettlement.accountB_B_proof = j.at("accountB_B_proof").get<Proof>();
}

}

#endif
