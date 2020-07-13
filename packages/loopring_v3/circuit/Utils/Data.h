#ifndef _DATA_H_
#define _DATA_H_

#include "Constants.h"

//#include "../ThirdParty/json.hpp"
#include "ethsnarks.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"

using json = nlohmann::json;


namespace Loopring
{

enum class BlockType
{
    RingSettlement = 0,
    Deposit,
    OnchainWithdrawal,
    OffchainWithdrawal,
    OrderCancellation,
    InternalTransfer,

    COUNT
};

class Proof
{
public:
    std::vector<ethsnarks::FieldT> data;
};

static void from_json(const json& j, Proof& proof)
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
    ethsnarks::FieldT orderID;
};

static void from_json(const json& j, TradeHistoryLeaf& leaf)
{
    leaf.filled = ethsnarks::FieldT(j.at("filled").get<std::string>().c_str());
    leaf.orderID = ethsnarks::FieldT(j.at("orderID").get<std::string>().c_str());
}

class BalanceLeaf
{
public:
    ethsnarks::FieldT balance;
    ethsnarks::FieldT tradingHistoryRoot;
};

static void from_json(const json& j, BalanceLeaf& leaf)
{
    leaf.balance = ethsnarks::FieldT(j.at("balance").get<std::string>().c_str());
    leaf.tradingHistoryRoot = ethsnarks::FieldT(j.at("tradingHistoryRoot").get<std::string>().c_str());
}

class Account
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT nonce;
    ethsnarks::FieldT balancesRoot;
};

static void from_json(const json& j, Account& account)
{
    account.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    account.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    account.nonce = ethsnarks::FieldT(j.at("nonce"));
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

static void from_json(const json& j, BalanceUpdate& balanceUpdate)
{
    balanceUpdate.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    balanceUpdate.proof = j.at("proof").get<Proof>();
    balanceUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    balanceUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    balanceUpdate.before = j.at("before").get<BalanceLeaf>();
    balanceUpdate.after = j.at("after").get<BalanceLeaf>();
}

class TradeHistoryUpdate
{
public:
    ethsnarks::FieldT orderID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    TradeHistoryLeaf before;
    TradeHistoryLeaf after;
};

static void from_json(const json& j, TradeHistoryUpdate& tradeHistoryUpdate)
{
    tradeHistoryUpdate.orderID = ethsnarks::FieldT(j.at("orderID").get<std::string>().c_str());
    tradeHistoryUpdate.proof = j.at("proof").get<Proof>();
    tradeHistoryUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    tradeHistoryUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    tradeHistoryUpdate.before = j.at("before").get<TradeHistoryLeaf>();
    tradeHistoryUpdate.after = j.at("after").get<TradeHistoryLeaf>();
}

class AccountUpdate
{
public:
    ethsnarks::FieldT accountID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    Account before;
    Account after;
};

static void from_json(const json& j, AccountUpdate& accountUpdate)
{
    accountUpdate.accountID = ethsnarks::FieldT(j.at("accountID"));
    accountUpdate.proof = j.at("proof").get<Proof>();
    accountUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    accountUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    accountUpdate.before = j.at("before").get<Account>();
    accountUpdate.after = j.at("after").get<Account>();
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

static void from_json(const json& j, Signature& signature)
{
    signature.R.x = ethsnarks::FieldT(j.at("Rx").get<std::string>().c_str());
    signature.R.y = ethsnarks::FieldT(j.at("Ry").get<std::string>().c_str());
    signature.s = ethsnarks::FieldT(j.at("s").get<std::string>().c_str());
}

class Order
{
public:
    ethsnarks::FieldT exchangeID;
    ethsnarks::FieldT orderID;
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT tokenS;
    ethsnarks::FieldT tokenB;
    ethsnarks::FieldT amountS;
    ethsnarks::FieldT amountB;
    ethsnarks::FieldT allOrNone;
    ethsnarks::FieldT validSince;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT maxFeeBips;
    ethsnarks::FieldT buy;

    ethsnarks::FieldT feeBips;
    ethsnarks::FieldT rebateBips;

    Signature signature;
};

static void from_json(const json& j, Order& order)
{
    order.exchangeID = ethsnarks::FieldT(j.at("exchangeID"));
    order.orderID = ethsnarks::FieldT(j.at("orderID").get<std::string>().c_str());
    order.accountID = ethsnarks::FieldT(j.at("accountID"));
    order.tokenS = ethsnarks::FieldT(j.at("tokenS"));
    order.tokenB = ethsnarks::FieldT(j.at("tokenB"));
    order.amountS = ethsnarks::FieldT(j.at("amountS").get<std::string>().c_str());
    order.amountB = ethsnarks::FieldT(j.at("amountB").get<std::string>().c_str());
    order.allOrNone = ethsnarks::FieldT(j.at("allOrNone").get<bool>() ? 1 : 0);
    order.validSince = ethsnarks::FieldT(j.at("validSince"));
    order.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    order.maxFeeBips = ethsnarks::FieldT(j.at("maxFeeBips"));
    order.buy = ethsnarks::FieldT(j.at("buy").get<bool>() ? 1 : 0);

    order.feeBips = ethsnarks::FieldT(j.at("feeBips"));
    order.rebateBips = ethsnarks::FieldT(j.at("rebateBips"));

    order.signature = j.at("signature").get<Signature>();
}

class Ring
{
public:
    Order orderA;
    Order orderB;
    ethsnarks::FieldT fillS_A;
    ethsnarks::FieldT fillS_B;
};

static void from_json(const json& j, Ring& ring)
{
    ring.orderA = j.at("orderA").get<Order>();
    ring.orderB = j.at("orderB").get<Order>();
    ring.fillS_A = ethsnarks::FieldT(j["fFillS_A"]);
    ring.fillS_B = ethsnarks::FieldT(j["fFillS_B"]);
}

class RingSettlement
{
public:
    Ring ring;

    ethsnarks::FieldT accountsMerkleRoot;

    TradeHistoryUpdate tradeHistoryUpdate_A;
    TradeHistoryUpdate tradeHistoryUpdate_B;

    BalanceUpdate balanceUpdateS_A;
    BalanceUpdate balanceUpdateB_A;
    AccountUpdate accountUpdate_A;

    BalanceUpdate balanceUpdateS_B;
    BalanceUpdate balanceUpdateB_B;
    AccountUpdate accountUpdate_B;

    BalanceUpdate balanceUpdateA_P;
    BalanceUpdate balanceUpdateB_P;

    BalanceUpdate balanceUpdateA_O;
    BalanceUpdate balanceUpdateB_O;
};

static void from_json(const json& j, RingSettlement& ringSettlement)
{
    ringSettlement.ring = j.at("ring").get<Ring>();

    ringSettlement.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());

    ringSettlement.tradeHistoryUpdate_A = j.at("tradeHistoryUpdate_A").get<TradeHistoryUpdate>();
    ringSettlement.tradeHistoryUpdate_B = j.at("tradeHistoryUpdate_B").get<TradeHistoryUpdate>();

    ringSettlement.balanceUpdateS_A = j.at("balanceUpdateS_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_A = j.at("balanceUpdateB_A").get<BalanceUpdate>();
    ringSettlement.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();

    ringSettlement.balanceUpdateS_B = j.at("balanceUpdateS_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_B = j.at("balanceUpdateB_B").get<BalanceUpdate>();
    ringSettlement.accountUpdate_B = j.at("accountUpdate_B").get<AccountUpdate>();

    ringSettlement.balanceUpdateA_P = j.at("balanceUpdateA_P").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_P = j.at("balanceUpdateB_P").get<BalanceUpdate>();

    ringSettlement.balanceUpdateA_O = j.at("balanceUpdateA_O").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_O = j.at("balanceUpdateB_O").get<BalanceUpdate>();
}

class RingSettlementBlock
{
public:

    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT timestamp;

    ethsnarks::FieldT protocolTakerFeeBips;
    ethsnarks::FieldT protocolMakerFeeBips;

    Signature signature;

    AccountUpdate accountUpdate_P;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::RingSettlement> ringSettlements;
};

static void from_json(const json& j, RingSettlementBlock& block)
{
    block.exchangeID = ethsnarks::FieldT(j["exchangeID"].get<unsigned int>());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.timestamp = ethsnarks::FieldT(j["timestamp"].get<unsigned int>());

    block.protocolTakerFeeBips = ethsnarks::FieldT(j["protocolTakerFeeBips"].get<unsigned int>());
    block.protocolMakerFeeBips = ethsnarks::FieldT(j["protocolMakerFeeBips"].get<unsigned int>());

    block.signature = j.at("signature").get<Signature>();

    block.accountUpdate_P = j.at("accountUpdate_P").get<AccountUpdate>();

    block.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    block.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read settlements
    json jRingSettlements = j["ringSettlements"];
    for(unsigned int i = 0; i < jRingSettlements.size(); i++)
    {
        block.ringSettlements.emplace_back(jRingSettlements[i].get<Loopring::RingSettlement>());
    }
}

class Deposit
{
public:
    ethsnarks::FieldT amount;
    BalanceUpdate balanceUpdate;
    AccountUpdate accountUpdate;
};

static void from_json(const json& j, Deposit& deposit)
{
    deposit.amount = ethsnarks::FieldT(j.at("amount").get<std::string>().c_str());
    deposit.balanceUpdate = j.at("balanceUpdate").get<BalanceUpdate>();
    deposit.accountUpdate = j.at("accountUpdate").get<AccountUpdate>();
}

class DepositBlock
{
public:
    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::LimbT startHash;

    ethsnarks::FieldT startIndex;
    ethsnarks::FieldT count;

    std::vector<Loopring::Deposit> deposits;
};

static void from_json(const json& j, DepositBlock& block)
{
    block.exchangeID = ethsnarks::FieldT(j["exchangeID"].get<unsigned int>());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.startHash = ethsnarks::LimbT(j["startHash"].get<std::string>().c_str());

    block.startIndex = ethsnarks::FieldT(j["startIndex"].get<std::string>().c_str());
    block.count = ethsnarks::FieldT(j["count"].get<std::string>().c_str());

    // Read deposits
    json jDeposits = j["deposits"];
    for(unsigned int i = 0; i < jDeposits.size(); i++)
    {
        block.deposits.emplace_back(jDeposits[i].get<Loopring::Deposit>());
    }
}

class OnchainWithdrawal
{
public:
    ethsnarks::FieldT amountRequested;
    BalanceUpdate balanceUpdate;
    AccountUpdate accountUpdate;
};

static void from_json(const json& j, OnchainWithdrawal& withdrawal)
{
    withdrawal.amountRequested = ethsnarks::FieldT(j.at("amountRequested").get<std::string>().c_str());
    withdrawal.balanceUpdate = j.at("balanceUpdate").get<BalanceUpdate>();
    withdrawal.accountUpdate = j.at("accountUpdate").get<AccountUpdate>();
}

class OnchainWithdrawalBlock
{
public:

    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::LimbT startHash;

    ethsnarks::FieldT startIndex;
    ethsnarks::FieldT count;

    std::vector<Loopring::OnchainWithdrawal> withdrawals;
};

static void from_json(const json& j, OnchainWithdrawalBlock& block)
{
    block.exchangeID = ethsnarks::FieldT(j["exchangeID"].get<unsigned int>());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.startHash = ethsnarks::LimbT(j["startHash"].get<std::string>().c_str());

    block.startIndex = ethsnarks::FieldT(j["startIndex"].get<std::string>().c_str());
    block.count = ethsnarks::FieldT(j["count"].get<std::string>().c_str());

    // Read withdrawals
    json jWithdrawals = j["withdrawals"];
    for(unsigned int i = 0; i < jWithdrawals.size(); i++)
    {
        block.withdrawals.emplace_back(jWithdrawals[i].get<Loopring::OnchainWithdrawal>());
    }
}


class OffchainWithdrawal
{
public:
    ethsnarks::FieldT amountRequested;
    ethsnarks::FieldT fee;
    Signature signature;

    BalanceUpdate balanceUpdateF_A;
    BalanceUpdate balanceUpdateW_A;
    AccountUpdate accountUpdate_A;
    BalanceUpdate balanceUpdateF_O;
};

static void from_json(const json& j, OffchainWithdrawal& withdrawal)
{
    withdrawal.amountRequested = ethsnarks::FieldT(j.at("amountRequested").get<std::string>().c_str());
    withdrawal.fee = ethsnarks::FieldT(j["fee"].get<std::string>().c_str());
    withdrawal.signature = j.at("signature").get<Signature>();

    withdrawal.balanceUpdateF_A = j.at("balanceUpdateF_A").get<BalanceUpdate>();
    withdrawal.balanceUpdateW_A = j.at("balanceUpdateW_A").get<BalanceUpdate>();
    withdrawal.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();
    withdrawal.balanceUpdateF_O = j.at("balanceUpdateF_O").get<BalanceUpdate>();
}

class OffchainWithdrawalBlock
{
public:

    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::LimbT startHash;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::OffchainWithdrawal> withdrawals;
};

static void from_json(const json& j, OffchainWithdrawalBlock& block)
{
    block.exchangeID = ethsnarks::FieldT(j["exchangeID"].get<unsigned int>());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    block.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read withdrawals
    json jWithdrawals = j["withdrawals"];
    for(unsigned int i = 0; i < jWithdrawals.size(); i++)
    {
        block.withdrawals.emplace_back(jWithdrawals[i].get<Loopring::OffchainWithdrawal>());
    }
}

/*
 * New internal transfer protocal
 */
class InternalTransfer
{
public:
    ethsnarks::FieldT fee;
    ethsnarks::FieldT amount;
    ethsnarks::FieldT type;
    Signature signature;

    ethsnarks::FieldT numConditionalTransfersAfter;

    BalanceUpdate balanceUpdateF_From; // pay fee step
    BalanceUpdate balanceUpdateT_From; // transfer step
    AccountUpdate accountUpdate_From;

    BalanceUpdate balanceUpdateT_To;   // receive transfer
    AccountUpdate accountUpdate_To;

    BalanceUpdate balanceUpdateF_O;	   // receive fee
};

static void from_json(const json& j, InternalTransfer& interTrans)
{
    interTrans.fee = ethsnarks::FieldT(j["fee"].get<std::string>().c_str());
    interTrans.amount = ethsnarks::FieldT(j["amountRequested"].get<std::string>().c_str());
    interTrans.type = ethsnarks::FieldT(j.at("type"));
    interTrans.signature = j.at("signature").get<Signature>();

    interTrans.numConditionalTransfersAfter = ethsnarks::FieldT(j.at("numConditionalTransfersAfter"));

    interTrans.balanceUpdateF_From = j.at("balanceUpdateF_From").get<BalanceUpdate>();
    interTrans.balanceUpdateT_From = j.at("balanceUpdateT_From").get<BalanceUpdate>();
    interTrans.accountUpdate_From = j.at("accountUpdate_From").get<AccountUpdate>();

    interTrans.balanceUpdateT_To = j.at("balanceUpdateT_To").get<BalanceUpdate>();
    interTrans.accountUpdate_To = j.at("accountUpdate_To").get<AccountUpdate>();

    interTrans.balanceUpdateF_O = j.at("balanceUpdateF_O").get<BalanceUpdate>();
}

class InternalTransferBlock
{
public:
    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::InternalTransfer> transfers;
};

static void from_json(const json& j, InternalTransferBlock& block)
{
    block.exchangeID = ethsnarks::FieldT(j["exchangeID"].get<unsigned int>());

    block.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    block.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    block.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    block.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read internal transfers
    json jTransfers = j["transfers"];
    for(unsigned int i = 0; i < jTransfers.size(); i++)
    {
        block.transfers.emplace_back(jTransfers[i].get<Loopring::InternalTransfer>());
    }
}


}

#endif
