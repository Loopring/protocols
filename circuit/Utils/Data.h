#ifndef _DATA_H_
#define _DATA_H_

#include "Constants.h"

#include "../ThirdParty/json.hpp"
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

class BalanceLeaf
{
public:
    ethsnarks::FieldT balance;
    ethsnarks::FieldT tradingHistoryRoot;
};

void from_json(const json& j, BalanceLeaf& leaf)
{
    leaf.balance = ethsnarks::FieldT(j.at("balance").get<std::string>().c_str());
    leaf.tradingHistoryRoot = ethsnarks::FieldT(j.at("tradingHistoryRoot").get<std::string>().c_str());
}

class Account
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT walletID;
    ethsnarks::FieldT nonce;
    ethsnarks::FieldT balancesRoot;
};

void from_json(const json& j, Account& account)
{
    account.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    account.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    account.walletID = ethsnarks::FieldT(j.at("walletID"));
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

void from_json(const json& j, BalanceUpdate& balanceUpdate)
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

void from_json(const json& j, TradeHistoryUpdate& tradeHistoryUpdate)
{
    tradeHistoryUpdate.orderID = ethsnarks::FieldT(j.at("orderID"));
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

void from_json(const json& j, AccountUpdate& accountUpdate)
{
    accountUpdate.accountID = ethsnarks::FieldT(j.at("accountID"));
    accountUpdate.proof = j.at("proof").get<Proof>();
    accountUpdate.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    accountUpdate.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    accountUpdate.before = j.at("before").get<Account>();
    accountUpdate.after = j.at("after").get<Account>();
}

class FeeBalanceLeaf
{
public:
    ethsnarks::FieldT balance;
};

void from_json(const json& j, FeeBalanceLeaf& leaf)
{
    leaf.balance = ethsnarks::FieldT(j.at("balance").get<std::string>().c_str());
}


class FeeTokenLeaf
{
public:
    ethsnarks::FieldT balance;
    ethsnarks::FieldT walletsRoot;
    ethsnarks::FieldT ringmatchersRoot;
};

void from_json(const json& j, FeeTokenLeaf& leaf)
{
    leaf.balance = ethsnarks::FieldT(j.at("balance").get<std::string>().c_str());
    leaf.walletsRoot = ethsnarks::FieldT(j.at("walletsRoot").get<std::string>().c_str());
    leaf.ringmatchersRoot = ethsnarks::FieldT(j.at("ringmatchersRoot").get<std::string>().c_str());
}

class FeeBalanceUpdate
{
public:
    ethsnarks::FieldT ID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    FeeBalanceLeaf before;
    FeeBalanceLeaf after;
};

void from_json(const json& j, FeeBalanceUpdate& update)
{
    update.ID = ethsnarks::FieldT(j.at("ID"));
    update.proof = j.at("proof").get<Proof>();
    update.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    update.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    update.before = j.at("before").get<FeeBalanceLeaf>();
    update.after = j.at("after").get<FeeBalanceLeaf>();
}


class FeeTokenUpdate
{
public:
    ethsnarks::FieldT tokenID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    FeeTokenLeaf before;
    FeeTokenLeaf after;
};

void from_json(const json& j, FeeTokenUpdate& update)
{
    update.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    update.proof = j.at("proof").get<Proof>();
    update.rootBefore = ethsnarks::FieldT(j.at("rootBefore").get<std::string>().c_str());
    update.rootAfter = ethsnarks::FieldT(j.at("rootAfter").get<std::string>().c_str());
    update.before = j.at("before").get<FeeTokenLeaf>();
    update.after = j.at("after").get<FeeTokenLeaf>();
}



class Signature
{
public:
    ethsnarks::jubjub::EdwardsPoint R;
    ethsnarks::FieldT s;
};

void from_json(const json& j, Signature& signature)
{
    signature.R.x = ethsnarks::FieldT(j.at("Rx").get<std::string>().c_str());
    signature.R.y = ethsnarks::FieldT(j.at("Ry").get<std::string>().c_str());
    signature.s = ethsnarks::FieldT(j.at("s").get<std::string>().c_str());
}

class Order
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::jubjub::EdwardsPoint walletPublicKey;
    ethsnarks::FieldT stateID;
    ethsnarks::FieldT walletID;
    ethsnarks::FieldT orderID;
    ethsnarks::FieldT accountID;
    ethsnarks::FieldT dualAuthAccountID;
    ethsnarks::FieldT tokenS;
    ethsnarks::FieldT tokenB;
    ethsnarks::FieldT tokenF;
    ethsnarks::FieldT amountS;
    ethsnarks::FieldT amountB;
    ethsnarks::FieldT amountF;

    ethsnarks::FieldT allOrNone;
    ethsnarks::FieldT validSince;
    ethsnarks::FieldT validUntil;
    ethsnarks::FieldT walletSplitPercentage;
    ethsnarks::FieldT waiveFeePercentage;

    ethsnarks::FieldT filledBefore;
    ethsnarks::FieldT cancelled;
    ethsnarks::FieldT nonce;

    ethsnarks::FieldT balanceS;
    ethsnarks::FieldT balanceB;
    ethsnarks::FieldT balanceF;
    Signature signature;

    ethsnarks::FieldT valid;
};

void from_json(const json& j, Order& order)
{
    order.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    order.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    order.walletPublicKey.x = ethsnarks::FieldT(j.at("walletPublicKeyX").get<std::string>().c_str());
    order.walletPublicKey.y = ethsnarks::FieldT(j.at("walletPublicKeyY").get<std::string>().c_str());

    order.stateID = ethsnarks::FieldT(j.at("stateID"));
    order.walletID = ethsnarks::FieldT(j.at("walletID"));
    order.orderID = ethsnarks::FieldT(j.at("orderID"));
    order.accountID = ethsnarks::FieldT(j.at("accountID"));
    order.dualAuthAccountID = ethsnarks::FieldT(j.at("dualAuthAccountID"));
    order.tokenS = ethsnarks::FieldT(j.at("tokenS"));
    order.tokenB = ethsnarks::FieldT(j.at("tokenB"));
    order.tokenF = ethsnarks::FieldT(j.at("tokenF"));
    order.amountS = ethsnarks::FieldT(j.at("amountS").get<std::string>().c_str());
    order.amountB = ethsnarks::FieldT(j.at("amountB").get<std::string>().c_str());
    order.amountF = ethsnarks::FieldT(j.at("amountF").get<std::string>().c_str());

    order.allOrNone = ethsnarks::FieldT(j.at("allOrNone").get<bool>() ? 1 : 0);
    order.validSince = ethsnarks::FieldT(j.at("validSince"));
    order.validUntil = ethsnarks::FieldT(j.at("validUntil"));
    order.walletSplitPercentage = ethsnarks::FieldT(j.at("walletSplitPercentage"));
    order.waiveFeePercentage = ethsnarks::FieldT(j.at("waiveFeePercentage"));

    order.filledBefore = ethsnarks::FieldT(j.at("filledBefore").get<std::string>().c_str());
    order.cancelled = ethsnarks::FieldT(j.at("cancelled"));
    order.nonce = ethsnarks::FieldT(j.at("nonce"));

    order.balanceS = ethsnarks::FieldT(j.at("balanceS").get<std::string>().c_str());
    order.balanceB = ethsnarks::FieldT(j.at("balanceB").get<std::string>().c_str());
    order.balanceF = ethsnarks::FieldT(j.at("balanceF").get<std::string>().c_str());
    order.signature = j.at("signature").get<Signature>();

    order.valid = ethsnarks::FieldT(j.at("valid").get<bool>() ? 1 : 0);
}

class Ring
{
public:
    Order orderA;
    Order orderB;

    ethsnarks::FieldT valid;

    ethsnarks::FieldT fillS_A;
    ethsnarks::FieldT fillB_A;
    ethsnarks::FieldT fillF_A;
    ethsnarks::FieldT fillS_B;
    ethsnarks::FieldT fillB_B;
    ethsnarks::FieldT fillF_B;
    ethsnarks::FieldT margin;

    ethsnarks::FieldT minerAccountID;
    ethsnarks::FieldT feeRecipientAccountID;
    ethsnarks::FieldT tokenID;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT nonce;

    Signature minerSignature;
    Signature walletASignature;
    Signature walletBSignature;
};

void from_json(const json& j, Ring& ring)
{
    ring.orderA = j.at("orderA").get<Order>();
    ring.orderB = j.at("orderB").get<Order>();

    ring.valid = ethsnarks::FieldT(j.at("valid").get<bool>() ? 1 : 0);

    ring.fillS_A = ethsnarks::FieldT(j.at("fillS_A").get<std::string>().c_str());
    ring.fillB_A = ethsnarks::FieldT(j.at("fillB_A").get<std::string>().c_str());
    ring.fillF_A = ethsnarks::FieldT(j.at("fillF_A").get<std::string>().c_str());
    ring.fillS_B = ethsnarks::FieldT(j.at("fillS_B").get<std::string>().c_str());
    ring.fillB_B = ethsnarks::FieldT(j.at("fillB_B").get<std::string>().c_str());
    ring.fillF_B = ethsnarks::FieldT(j.at("fillF_B").get<std::string>().c_str());
    ring.margin = ethsnarks::FieldT(j.at("margin").get<std::string>().c_str());

    ring.minerAccountID = ethsnarks::FieldT(j.at("minerAccountID"));
    ring.feeRecipientAccountID = ethsnarks::FieldT(j.at("feeRecipientAccountID"));
    ring.tokenID = ethsnarks::FieldT(j.at("tokenID"));
    ring.fee = ethsnarks::FieldT(j.at("fee").get<std::string>().c_str());
    ring.nonce = ethsnarks::FieldT(j.at("nonce"));

    ring.minerSignature = j.at("minerSignature").get<Signature>();
    ring.walletASignature = j.at("walletASignature").get<Signature>();
    ring.walletBSignature = j.at("walletBSignature").get<Signature>();
}

class RingSettlement
{
public:
    ethsnarks::FieldT accountsMerkleRoot;
    Ring ring;

    TradeHistoryUpdate tradeHistoryUpdate_A;
    TradeHistoryUpdate tradeHistoryUpdate_B;

    BalanceUpdate balanceUpdateS_A;
    BalanceUpdate balanceUpdateB_A;
    BalanceUpdate balanceUpdateF_A;
    AccountUpdate accountUpdate_A;

    BalanceUpdate balanceUpdateS_B;
    BalanceUpdate balanceUpdateB_B;
    BalanceUpdate balanceUpdateF_B;
    AccountUpdate accountUpdate_B;

    BalanceUpdate balanceUpdateA_W;
    AccountUpdate accountUpdateA_W;

    BalanceUpdate balanceUpdateB_W;
    AccountUpdate accountUpdateB_W;

    BalanceUpdate balanceUpdateA_F;
    BalanceUpdate balanceUpdateB_F;
    AccountUpdate accountUpdate_F;

    BalanceUpdate balanceUpdateM_M;
    BalanceUpdate balanceUpdateO_M;
    AccountUpdate accountUpdate_M;

    BalanceUpdate balanceUpdateF_O;
};

void from_json(const json& j, RingSettlement& ringSettlement)
{
    ringSettlement.accountsMerkleRoot = ethsnarks::FieldT(j.at("accountsMerkleRoot").get<std::string>().c_str());

    ringSettlement.ring = j.at("ring").get<Ring>();

    ringSettlement.tradeHistoryUpdate_A = j.at("tradeHistoryUpdate_A").get<TradeHistoryUpdate>();
    ringSettlement.tradeHistoryUpdate_B = j.at("tradeHistoryUpdate_B").get<TradeHistoryUpdate>();

    ringSettlement.balanceUpdateS_A = j.at("balanceUpdateS_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_A = j.at("balanceUpdateB_A").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_A = j.at("balanceUpdateF_A").get<BalanceUpdate>();
    ringSettlement.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();

    ringSettlement.balanceUpdateS_B = j.at("balanceUpdateS_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_B = j.at("balanceUpdateB_B").get<BalanceUpdate>();
    ringSettlement.balanceUpdateF_B = j.at("balanceUpdateF_B").get<BalanceUpdate>();
    ringSettlement.accountUpdate_B = j.at("accountUpdate_B").get<AccountUpdate>();

    ringSettlement.balanceUpdateA_W = j.at("balanceUpdateA_W").get<BalanceUpdate>();
    ringSettlement.accountUpdateA_W = j.at("accountUpdateA_W").get<AccountUpdate>();

    ringSettlement.balanceUpdateB_W = j.at("balanceUpdateB_W").get<BalanceUpdate>();
    ringSettlement.accountUpdateB_W = j.at("accountUpdateB_W").get<AccountUpdate>();

    ringSettlement.balanceUpdateA_F = j.at("balanceUpdateA_F").get<BalanceUpdate>();
    ringSettlement.balanceUpdateB_F = j.at("balanceUpdateB_F").get<BalanceUpdate>();
    ringSettlement.accountUpdate_F = j.at("accountUpdate_F").get<AccountUpdate>();

    ringSettlement.balanceUpdateM_M = j.at("balanceUpdateM_M").get<BalanceUpdate>();
    ringSettlement.balanceUpdateO_M = j.at("balanceUpdateO_M").get<BalanceUpdate>();
    ringSettlement.accountUpdate_M = j.at("accountUpdate_M").get<AccountUpdate>();

    ringSettlement.balanceUpdateF_O = j.at("balanceUpdateF_O").get<BalanceUpdate>();
}

class TradeContext
{
public:

    ethsnarks::FieldT stateID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT timestamp;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::RingSettlement> ringSettlements;
};

void from_json(const json& j, TradeContext& context)
{
    context.stateID = ethsnarks::FieldT(j["stateID"].get<unsigned int>());

    context.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    context.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    context.timestamp = ethsnarks::FieldT(j["timestamp"].get<unsigned int>());

    context.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    context.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read settlements
    json jRingSettlements = j["ringSettlements"];
    for(unsigned int i = 0; i < jRingSettlements.size(); i++)
    {
        context.ringSettlements.emplace_back(jRingSettlements[i].get<Loopring::RingSettlement>());
    }
}

class Deposit
{
public:
    AccountUpdate accountUpdate;
    BalanceUpdate balanceUpdate;
};

void from_json(const json& j, Deposit& deposit)
{
    deposit.accountUpdate = j.at("accountUpdate").get<AccountUpdate>();
    deposit.balanceUpdate = j.at("balanceUpdate").get<BalanceUpdate>();
}

class DepositContext
{
public:
    ethsnarks::FieldT stateID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    std::vector<Loopring::Deposit> deposits;
};

void from_json(const json& j, DepositContext& context)
{
    context.stateID = ethsnarks::FieldT(j["stateID"].get<unsigned int>());

    context.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    context.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    // Read deposits
    json jDeposits = j["deposits"];
    for(unsigned int i = 0; i < jDeposits.size(); i++)
    {
        context.deposits.emplace_back(jDeposits[i].get<Loopring::Deposit>());
    }
}

class Withdrawal
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::jubjub::EdwardsPoint walletPublicKey;
    ethsnarks::FieldT amount;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT walletSplitPercentage;
    Signature signature;
    Signature walletSignature;

    BalanceUpdate balanceUpdateF_A;
    BalanceUpdate balanceUpdateW_A;
    AccountUpdate accountUpdate_A;
    BalanceUpdate balanceUpdateF_W;
    AccountUpdate accountUpdate_W;
    BalanceUpdate balanceUpdateF_O;
};

void from_json(const json& j, Withdrawal& withdrawal)
{
    withdrawal.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    withdrawal.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    withdrawal.walletPublicKey.x = ethsnarks::FieldT(j.at("walletPublicKeyX").get<std::string>().c_str());
    withdrawal.walletPublicKey.y = ethsnarks::FieldT(j.at("walletPublicKeyY").get<std::string>().c_str());
    withdrawal.amount = ethsnarks::FieldT(j.at("amount").get<std::string>().c_str());
    withdrawal.fee = ethsnarks::FieldT(j.at("fee").get<std::string>().c_str());
    withdrawal.walletSplitPercentage = ethsnarks::FieldT(j.at("walletSplitPercentage"));
    withdrawal.signature = j.at("signature").get<Signature>();

    withdrawal.balanceUpdateF_A = j.at("balanceUpdateF_A").get<BalanceUpdate>();
    withdrawal.balanceUpdateW_A = j.at("balanceUpdateW_A").get<BalanceUpdate>();
    withdrawal.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();
    withdrawal.balanceUpdateF_W = j.at("balanceUpdateF_W").get<BalanceUpdate>();
    withdrawal.accountUpdate_W = j.at("accountUpdate_W").get<AccountUpdate>();
    withdrawal.balanceUpdateF_O = j.at("balanceUpdateF_O").get<BalanceUpdate>();
    withdrawal.walletSignature = j.at("walletSignature").get<Signature>();
}

class WithdrawContext
{
public:

    ethsnarks::FieldT stateID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::Withdrawal> withdrawals;
};

void from_json(const json& j, WithdrawContext& context)
{
    context.stateID = ethsnarks::FieldT(j["stateID"].get<unsigned int>());

    context.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    context.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    context.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    context.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read withdrawals
    json jWithdrawals = j["withdrawals"];
    for(unsigned int i = 0; i < jWithdrawals.size(); i++)
    {
        context.withdrawals.emplace_back(jWithdrawals[i].get<Loopring::Withdrawal>());
    }
}


class Cancellation
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::jubjub::EdwardsPoint walletPublicKey;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT walletSplitPercentage;
    TradeHistoryUpdate tradeHistoryUpdate_A;
    BalanceUpdate balanceUpdateT_A;
    BalanceUpdate balanceUpdateF_A;
    AccountUpdate accountUpdate_A;
    BalanceUpdate balanceUpdateF_W;
    AccountUpdate accountUpdate_W;
    BalanceUpdate balanceUpdateF_O;
    Signature signature;
    Signature walletSignature;
};

void from_json(const json& j, Cancellation& cancellation)
{
    cancellation.publicKey.x = ethsnarks::FieldT(j.at("publicKeyX").get<std::string>().c_str());
    cancellation.publicKey.y = ethsnarks::FieldT(j.at("publicKeyY").get<std::string>().c_str());
    cancellation.walletPublicKey.x = ethsnarks::FieldT(j.at("walletPublicKeyX").get<std::string>().c_str());
    cancellation.walletPublicKey.y = ethsnarks::FieldT(j.at("walletPublicKeyY").get<std::string>().c_str());
    cancellation.fee = ethsnarks::FieldT(j.at("fee").get<std::string>().c_str());
    cancellation.walletSplitPercentage = ethsnarks::FieldT(j.at("walletSplitPercentage"));
    cancellation.tradeHistoryUpdate_A = j.at("tradeHistoryUpdate_A").get<TradeHistoryUpdate>();
    cancellation.balanceUpdateT_A = j.at("balanceUpdateT_A").get<BalanceUpdate>();
    cancellation.balanceUpdateF_A = j.at("balanceUpdateF_A").get<BalanceUpdate>();
    cancellation.accountUpdate_A = j.at("accountUpdate_A").get<AccountUpdate>();
    cancellation.balanceUpdateF_W = j.at("balanceUpdateF_W").get<BalanceUpdate>();
    cancellation.accountUpdate_W = j.at("accountUpdate_W").get<AccountUpdate>();
    cancellation.balanceUpdateF_O = j.at("balanceUpdateF_O").get<BalanceUpdate>();
    cancellation.signature = j.at("signature").get<Signature>();
    cancellation.walletSignature = j.at("walletSignature").get<Signature>();
}

class CancelContext
{
public:
    ethsnarks::FieldT stateID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::Cancellation> cancels;
};

void from_json(const json& j, CancelContext& context)
{
    context.stateID = ethsnarks::FieldT(j["stateID"].get<unsigned int>());

    context.merkleRootBefore = ethsnarks::FieldT(j["merkleRootBefore"].get<std::string>().c_str());
    context.merkleRootAfter = ethsnarks::FieldT(j["merkleRootAfter"].get<std::string>().c_str());

    context.operatorAccountID = ethsnarks::FieldT(j.at("operatorAccountID"));
    context.accountUpdate_O = j.at("accountUpdate_O").get<AccountUpdate>();

    // Read cancels
    json jCancels = j["cancels"];
    for(unsigned int i = 0; i < jCancels.size(); i++)
    {
        context.cancels.emplace_back(jCancels[i].get<Loopring::Cancellation>());
    }
}

}

#endif
