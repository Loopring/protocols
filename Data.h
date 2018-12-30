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
    ethsnarks::FieldT owner;
    ethsnarks::FieldT tokenS;
    ethsnarks::FieldT tokenB;
    ethsnarks::FieldT tokenF;
    ethsnarks::FieldT amountS;
    ethsnarks::FieldT amountB;
    ethsnarks::FieldT amountF;
    Signature sig;
};

void from_json(const json& j, Order& order)
{
    order.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    order.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    order.owner = ethsnarks::FieldT(j.at("owner").get<std::string>().c_str());
    order.tokenS = ethsnarks::FieldT(j.at("tokenS").get<std::string>().c_str());
    order.tokenB = ethsnarks::FieldT(j.at("tokenB").get<std::string>().c_str());
    order.tokenF = ethsnarks::FieldT(j.at("tokenF").get<std::string>().c_str());
    order.amountS = ethsnarks::FieldT(j.at("amountS"));
    order.amountB = ethsnarks::FieldT(j.at("amountB"));
    order.amountF = ethsnarks::FieldT(j.at("amountF"));
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
    ethsnarks::FieldT merkleRoot;
    Ring ring;

    ethsnarks::FieldT filledA;
    ethsnarks::FieldT filledB;

    std::vector<ethsnarks::FieldT> proofA;
    std::vector<ethsnarks::FieldT> proofB;
};

void from_json(const json& j, RingSettlement& ringSettlement)
{
    ringSettlement.merkleRoot = ethsnarks::FieldT(j.at("merkleRoot").get<std::string>().c_str());

    ringSettlement.ring = j.at("ring").get<Ring>();

    ringSettlement.filledA = ethsnarks::FieldT(j.at("filledA"));
    ringSettlement.filledB = ethsnarks::FieldT(j.at("filledB"));

    for(unsigned int i = 0; i < j.at("proofA").size(); i++)
    {
        ringSettlement.proofA.push_back(ethsnarks::FieldT(j.at("proofA")[i].get<std::string>().c_str()));
    }
    for(unsigned int i = 0; i < j.at("proofB").size(); i++)
    {
        ringSettlement.proofB.push_back(ethsnarks::FieldT(j.at("proofB")[i].get<std::string>().c_str()));
    }
}

}

#endif
