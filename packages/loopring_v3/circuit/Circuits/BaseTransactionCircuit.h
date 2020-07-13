#ifndef _BASETRANSACTIONCIRCUIT_H_
#define _BASETRANSACTIONCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "../ThirdParty/BigIntHeader.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

struct TransactionAccountState : public GadgetT
{
    TradeHistoryGadget tradeHistory;
    BalanceGadget balanceS;
    BalanceGadget balanceB;
    AccountGadget account;

    TransactionAccountState(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        tradeHistory(pb, FMT(prefix, ".tradeHistory")),
        balanceS(pb, FMT(prefix, ".balanceS")),
        balanceB(pb, FMT(prefix, ".balanceB")),
        account(pb, FMT(prefix, ".account"))
    {

    }

    void generate_r1cs_witness(const Account& accountLeaf, const BalanceLeaf& balanceLeafS, const BalanceLeaf& balanceLeafB, const TradeHistoryLeaf& tradeHistoryLeaf)
    {
        tradeHistory.generate_r1cs_witness(tradeHistoryLeaf);
        balanceS.generate_r1cs_witness(balanceLeafS);
        balanceB.generate_r1cs_witness(balanceLeafB);
        account.generate_r1cs_witness(accountLeaf);
    }
};

struct TransactionAccountOperatorState : public GadgetT
{
    BalanceGadget balanceA;
    BalanceGadget balanceB;
    AccountGadget account;

    TransactionAccountOperatorState(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        balanceA(pb, FMT(prefix, ".balanceA")),
        balanceB(pb, FMT(prefix, ".balanceB")),
        account(pb, FMT(prefix, ".account"))
    {

    }

    void generate_r1cs_witness(const Account& accountLeaf, const BalanceLeaf& balanceLeafS, const BalanceLeaf& balanceLeafB)
    {
        balanceA.generate_r1cs_witness(balanceLeafS);
        balanceB.generate_r1cs_witness(balanceLeafB);
        account.generate_r1cs_witness(accountLeaf);
    }
};

struct TransactionAccountBalancesState : public GadgetT
{
    BalanceGadget balanceA;
    BalanceGadget balanceB;

    TransactionAccountBalancesState(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        balanceA(pb, FMT(prefix, ".balanceA")),
        balanceB(pb, FMT(prefix, ".balanceB"))
    {

    }

    void generate_r1cs_witness(const BalanceLeaf& balanceLeafA, const BalanceLeaf& balanceLeafB)
    {
        balanceA.generate_r1cs_witness(balanceLeafA);
        balanceB.generate_r1cs_witness(balanceLeafB);
    }
};

struct TransactionState : public GadgetT
{
    const jubjub::Params& params;

    const Constants& constants;

    const VariableT& exchange;
    const VariableT& timestamp;
    const VariableT& protocolTakerFeeBips;
    const VariableT& protocolMakerFeeBips;
    const VariableT& numConditionalTransactions;
    const VariableT& type;

    TransactionAccountState accountA;
    TransactionAccountState accountB;
    TransactionAccountOperatorState oper;
    TransactionAccountBalancesState pool;
    TransactionAccountBalancesState index;

    TransactionState(
        ProtoboardT& pb,
        const jubjub::Params& _params,
        const Constants& _constants,
        const VariableT& _exchange,
        const VariableT& _timestamp,
        const VariableT& _protocolTakerFeeBips,
        const VariableT& _protocolMakerFeeBips,
        const VariableT& _numConditionalTransactions,
        const VariableT& _type,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        params(_params),

        constants(_constants),

        exchange(_exchange),
        timestamp(_timestamp),
        protocolTakerFeeBips(_protocolTakerFeeBips),
        protocolMakerFeeBips(_protocolMakerFeeBips),
        numConditionalTransactions(_numConditionalTransactions),
        type(_type),

        accountA(pb, FMT(prefix, ".accountA")),
        accountB(pb, FMT(prefix, ".accountB")),
        oper(pb, FMT(prefix, ".oper")),
        pool(pb, FMT(prefix, ".pool")),
        index(pb, FMT(prefix, ".index"))
    {

    }

    void generate_r1cs_witness(const Account& account_A, const BalanceLeaf& balanceLeafS_A, const BalanceLeaf& balanceLeafB_A, const TradeHistoryLeaf& tradeHistoryLeaf_A,
                               const Account& account_B, const BalanceLeaf& balanceLeafS_B, const BalanceLeaf& balanceLeafB_B, const TradeHistoryLeaf& tradeHistoryLeaf_B,
                               const Account& account_O, const BalanceLeaf& balanceLeafA_O, const BalanceLeaf& balanceLeafB_O,
                               const BalanceLeaf& balanceLeafS_P, const BalanceLeaf& balanceLeafB_P,
                               const BalanceLeaf& balanceLeafS_I, const BalanceLeaf& balanceLeafB_I)
    {
        accountA.generate_r1cs_witness(account_A, balanceLeafS_A, balanceLeafB_A, tradeHistoryLeaf_A);
        accountB.generate_r1cs_witness(account_B, balanceLeafS_B, balanceLeafB_B, tradeHistoryLeaf_B);
        oper.generate_r1cs_witness(account_O, balanceLeafA_O, balanceLeafB_O);
        pool.generate_r1cs_witness(balanceLeafS_P, balanceLeafB_P);
        index.generate_r1cs_witness(balanceLeafS_I, balanceLeafB_I);
    }
};

enum TxVariable
{
    tradeHistoryA_Address,
    tradeHistoryA_Filled,
    tradeHistoryA_OrderId,

    balanceA_S_Address,
    balanceA_S_Balance,
    balanceA_S_Index,

    balanceA_B_Balance,
    balanceA_B_Index,

    accountA_Address,
    accountA_Owner,
    accountA_PublicKeyX,
    accountA_PublicKeyY,
    accountA_Nonce,
    accountA_WalletHash,


    tradeHistoryB_Address,
    tradeHistoryB_Filled,
    tradeHistoryB_OrderId,

    balanceB_S_Address,
    balanceB_S_Balance,
    balanceB_S_Index,

    balanceB_B_Balance,
    balanceB_B_Index,

    accountB_Address,
    accountB_Owner,
    accountB_PublicKeyX,
    accountB_PublicKeyY,
    accountB_Nonce,
    accountB_WalletHash,


    balanceP_A_Balance,
    balanceP_A_Index,
    balanceP_B_Balance,
    balanceP_B_Index,


    balanceO_A_Balance,
    balanceO_A_Index,
    balanceO_B_Balance,
    balanceO_B_Index,


    index_A,
    index_B,


    hash_A,
    publicKeyX_A,
    publicKeyY_A,
    signatureRequired_A,

    hash_B,
    publicKeyX_B,
    publicKeyY_B,
    signatureRequired_B,


    misc_NumConditionalTransactions
};

class BaseTransactionCircuit : public GadgetT
{
public:
    const TransactionState& state;

    std::map<TxVariable, VariableT> uOutputs;
    std::map<TxVariable, VariableArrayT> aOutputs;

    BaseTransactionCircuit(
        ProtoboardT& pb,
        const TransactionState& _state,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        state(_state)
    {
        aOutputs[tradeHistoryA_Address] = VariableArrayT(NUM_BITS_TRADING_HISTORY, state.constants.zero);
        uOutputs[tradeHistoryA_Filled] = state.accountA.tradeHistory.filled;
        uOutputs[tradeHistoryA_OrderId] = state.accountA.tradeHistory.orderID;

        aOutputs[balanceA_S_Address] = VariableArrayT(NUM_BITS_TOKEN, state.constants.zero);
        uOutputs[balanceA_S_Balance] = state.accountA.balanceS.balance;
        uOutputs[balanceA_S_Index] = state.accountA.balanceS.index;

        uOutputs[balanceA_B_Balance] = state.accountA.balanceB.balance;
        uOutputs[balanceA_B_Index] = state.accountA.balanceB.index;

        aOutputs[accountA_Address] = flatten({VariableArrayT(1, state.constants.zero), VariableArrayT(1, state.constants.one), VariableArrayT(NUM_BITS_ACCOUNT - 2, state.constants.zero)});
        uOutputs[accountA_Owner] = state.accountA.account.owner;
        uOutputs[accountA_PublicKeyX] = state.accountA.account.publicKey.x;
        uOutputs[accountA_PublicKeyY] = state.accountA.account.publicKey.y;
        uOutputs[accountA_Nonce] = state.accountA.account.nonce;
        uOutputs[accountA_WalletHash] = state.accountA.account.walletHash;


        aOutputs[tradeHistoryB_Address] = VariableArrayT(NUM_BITS_TRADING_HISTORY, state.constants.zero);
        uOutputs[tradeHistoryB_Filled] = state.accountB.tradeHistory.filled;
        uOutputs[tradeHistoryB_OrderId] = state.accountB.tradeHistory.orderID;

        aOutputs[balanceB_S_Address] = VariableArrayT(NUM_BITS_TOKEN, state.constants.zero);
        uOutputs[balanceB_S_Balance] = state.accountB.balanceS.balance;
        uOutputs[balanceB_S_Index] = state.accountB.balanceS.index;

        uOutputs[balanceB_B_Balance] = state.accountB.balanceB.balance;
        uOutputs[balanceB_B_Index] = state.accountB.balanceB.index;


        aOutputs[accountB_Address] = flatten({VariableArrayT(1, state.constants.zero), VariableArrayT(1, state.constants.one), VariableArrayT(NUM_BITS_ACCOUNT - 2, state.constants.zero)});
        uOutputs[accountB_Owner] = state.accountB.account.owner;
        uOutputs[accountB_PublicKeyX] = state.accountB.account.publicKey.x;
        uOutputs[accountB_PublicKeyY] = state.accountB.account.publicKey.y;
        uOutputs[accountB_Nonce] = state.accountB.account.nonce;
        uOutputs[accountB_WalletHash] = state.accountB.account.walletHash;


        uOutputs[balanceP_A_Balance] = state.pool.balanceA.balance;
        uOutputs[balanceP_A_Index] = state.pool.balanceA.index;
        uOutputs[balanceP_B_Balance] = state.pool.balanceB.balance;
        uOutputs[balanceP_B_Index] = state.pool.balanceB.index;


        uOutputs[balanceO_A_Balance] = state.oper.balanceA.balance;
        uOutputs[balanceO_A_Index] = state.oper.balanceA.index;
        uOutputs[balanceO_B_Balance] = state.oper.balanceB.balance;
        uOutputs[balanceO_B_Index] = state.oper.balanceB.index;


        uOutputs[index_A] = state.index.balanceA.index;
        uOutputs[index_B] = state.index.balanceB.index;


        uOutputs[hash_A] = state.constants.zero;
        uOutputs[publicKeyX_A] = state.accountA.account.publicKey.x;
        uOutputs[publicKeyY_A] = state.accountA.account.publicKey.y;
        uOutputs[signatureRequired_A] = state.constants.one;

        uOutputs[hash_B] = state.constants.zero;
        uOutputs[publicKeyX_B] = state.accountB.account.publicKey.x;
        uOutputs[publicKeyY_B] = state.accountB.account.publicKey.y;
        uOutputs[signatureRequired_B] = state.constants.one;


        uOutputs[misc_NumConditionalTransactions] = state.numConditionalTransactions;
    }

    const VariableT& getOutput(TxVariable txVariable) const
    {
        return uOutputs.at(txVariable);
    }

    const VariableArrayT& getArrayOutput(TxVariable txVariable) const
    {
        return aOutputs.at(txVariable);
    }

    void setOutput(TxVariable txVariable, const VariableT& var)
    {
        assert(uOutputs.find(txVariable) != uOutputs.end());
        uOutputs[txVariable] = var;
    }

    void setArrayOutput(TxVariable txVariable, const VariableArrayT& var)
    {
        assert(aOutputs.find(txVariable) != aOutputs.end());
        aOutputs[txVariable] = var;
    }

    virtual const VariableArrayT getPublicData() const = 0;
};

}

#endif