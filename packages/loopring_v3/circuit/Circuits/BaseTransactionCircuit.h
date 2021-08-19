// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
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
    StorageGadget storage;
    BalanceGadget balanceS;
    BalanceGadget balanceB;
    AccountGadget account;

    TransactionAccountState( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          storage(pb, FMT(prefix, ".storage")),
          balanceS(pb, FMT(prefix, ".balanceS")),
          balanceB(pb, FMT(prefix, ".balanceB")),
          account(pb, FMT(prefix, ".account"))
    {
    }

    void generate_r1cs_witness(
      const AccountLeaf &accountLeaf,
      const BalanceLeaf &balanceLeafS,
      const BalanceLeaf &balanceLeafB,
      const StorageLeaf &storageLeaf)
    {
        storage.generate_r1cs_witness(storageLeaf);
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

    TransactionAccountOperatorState( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")),
          balanceB(pb, FMT(prefix, ".balanceB")),
          account(pb, FMT(prefix, ".account"))
    {
    }

    void generate_r1cs_witness(
      const AccountLeaf &accountLeaf,
      const BalanceLeaf &balanceLeafS,
      const BalanceLeaf &balanceLeafB)
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

    TransactionAccountBalancesState( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")),
          balanceB(pb, FMT(prefix, ".balanceB"))
    {
    }

    void generate_r1cs_witness(const BalanceLeaf &balanceLeafA, const BalanceLeaf &balanceLeafB)
    {
        balanceA.generate_r1cs_witness(balanceLeafA);
        balanceB.generate_r1cs_witness(balanceLeafB);
    }
};

struct TransactionState : public GadgetT
{
    const jubjub::Params &params;

    const Constants &constants;

    const VariableT &exchange;
    const VariableT &timestamp;
    const VariableT &protocolTakerFeeBips;
    const VariableT &protocolMakerFeeBips;
    const VariableT &numConditionalTransactions;
    const VariableT &type;

    TransactionAccountState accountA;
    TransactionAccountState accountB;
    TransactionAccountOperatorState oper;
    TransactionAccountBalancesState pool;

    TransactionState(
      ProtoboardT &pb,
      const jubjub::Params &_params,
      const Constants &_constants,
      const VariableT &_exchange,
      const VariableT &_timestamp,
      const VariableT &_protocolTakerFeeBips,
      const VariableT &_protocolMakerFeeBips,
      const VariableT &_numConditionalTransactions,
      const VariableT &_type,
      const std::string &prefix)
        : GadgetT(pb, prefix),

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
          pool(pb, FMT(prefix, ".pool"))
    {
    }

    void generate_r1cs_witness(
      const AccountLeaf &account_A,
      const BalanceLeaf &balanceLeafS_A,
      const BalanceLeaf &balanceLeafB_A,
      const StorageLeaf &storageLeaf_A,
      const AccountLeaf &account_B,
      const BalanceLeaf &balanceLeafS_B,
      const BalanceLeaf &balanceLeafB_B,
      const StorageLeaf &storageLeaf_B,
      const AccountLeaf &account_O,
      const BalanceLeaf &balanceLeafA_O,
      const BalanceLeaf &balanceLeafB_O,
      const BalanceLeaf &balanceLeafS_P,
      const BalanceLeaf &balanceLeafB_P)
    {
        accountA.generate_r1cs_witness(account_A, balanceLeafS_A, balanceLeafB_A, storageLeaf_A);
        accountB.generate_r1cs_witness(account_B, balanceLeafS_B, balanceLeafB_B, storageLeaf_B);
        oper.generate_r1cs_witness(account_O, balanceLeafA_O, balanceLeafB_O);
        pool.generate_r1cs_witness(balanceLeafS_P, balanceLeafB_P);
    }
};

enum TxVariable
{
    TXV_STORAGE_A_ADDRESS,
    TXV_STORAGE_A_DATA,
    TXV_STORAGE_A_STORAGEID,

    TXV_BALANCE_A_S_ADDRESS,
    TXV_BALANCE_A_S_BALANCE,
    TXV_BALANCE_A_S_WEIGHTAMM,

    TXV_BALANCE_A_B_ADDRESS,
    TXV_BALANCE_A_B_BALANCE,
    TXV_BALANCE_A_B_WEIGHTAMM,

    TXV_ACCOUNT_A_ADDRESS,
    TXV_ACCOUNT_A_OWNER,
    TXV_ACCOUNT_A_PUBKEY_X,
    TXV_ACCOUNT_A_PUBKEY_Y,
    TXV_ACCOUNT_A_NONCE,
    TXV_ACCOUNT_A_FEEBIPSAMM,

    TXV_STORAGE_B_ADDRESS,
    TXV_STORAGE_B_DATA,
    TXV_STORAGE_B_STORAGEID,

    TXV_BALANCE_B_S_ADDRESS,
    TXV_BALANCE_B_S_BALANCE,
    TXV_BALANCE_B_S_WEIGHTAMM,

    TXV_BALANCE_B_B_ADDRESS,
    TXV_BALANCE_B_B_BALANCE,
    TXV_BALANCE_B_B_WEIGHTAMM,

    TXV_ACCOUNT_B_ADDRESS,
    TXV_ACCOUNT_B_OWNER,
    TXV_ACCOUNT_B_PUBKEY_X,
    TXV_ACCOUNT_B_PUBKEY_Y,
    TXV_ACCOUNT_B_NONCE,

    TXV_BALANCE_P_A_BALANCE,
    TXV_BALANCE_P_B_BALANCE,

    TXV_BALANCE_O_A_BALANCE,
    TXV_BALANCE_O_B_BALANCE,

    TXV_HASH_A,
    TXV_PUBKEY_X_A,
    TXV_PUBKEY_Y_A,
    TXV_SIGNATURE_REQUIRED_A,

    TXV_HASH_B,
    TXV_PUBKEY_X_B,
    TXV_PUBKEY_Y_B,
    TXV_SIGNATURE_REQUIRED_B,

    TXV_NUM_CONDITIONAL_TXS
};

class BaseTransactionCircuit : public GadgetT
{
  public:
    const TransactionState &state;

    std::map<TxVariable, VariableT> uOutputs;
    std::map<TxVariable, VariableArrayT> aOutputs;

    BaseTransactionCircuit( //
      ProtoboardT &pb,
      const TransactionState &_state,
      const std::string &prefix)
        : GadgetT(pb, prefix), state(_state)
    {
        aOutputs[TXV_STORAGE_A_ADDRESS] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[TXV_STORAGE_A_DATA] = state.accountA.storage.data;
        uOutputs[TXV_STORAGE_A_STORAGEID] = state.accountA.storage.storageID;

        aOutputs[TXV_BALANCE_A_S_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[TXV_BALANCE_A_S_BALANCE] = state.accountA.balanceS.balance;
        uOutputs[TXV_BALANCE_A_S_WEIGHTAMM] = state.accountA.balanceS.weightAMM;

        aOutputs[TXV_BALANCE_A_B_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[TXV_BALANCE_A_B_BALANCE] = state.accountA.balanceB.balance;
        uOutputs[TXV_BALANCE_A_B_WEIGHTAMM] = state.accountA.balanceB.weightAMM;

        aOutputs[TXV_ACCOUNT_A_ADDRESS] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[TXV_ACCOUNT_A_OWNER] = state.accountA.account.owner;
        uOutputs[TXV_ACCOUNT_A_PUBKEY_X] = state.accountA.account.publicKey.x;
        uOutputs[TXV_ACCOUNT_A_PUBKEY_Y] = state.accountA.account.publicKey.y;
        uOutputs[TXV_ACCOUNT_A_NONCE] = state.accountA.account.nonce;
        uOutputs[TXV_ACCOUNT_A_FEEBIPSAMM] = state.accountA.account.feeBipsAMM;

        aOutputs[TXV_STORAGE_B_ADDRESS] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[TXV_STORAGE_B_DATA] = state.accountB.storage.data;
        uOutputs[TXV_STORAGE_B_STORAGEID] = state.accountB.storage.storageID;

        aOutputs[TXV_BALANCE_B_S_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[TXV_BALANCE_B_S_BALANCE] = state.accountB.balanceS.balance;
        uOutputs[TXV_BALANCE_B_S_WEIGHTAMM] = state.accountB.balanceS.weightAMM;

        aOutputs[TXV_BALANCE_B_B_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[TXV_BALANCE_B_B_BALANCE] = state.accountB.balanceB.balance;
        uOutputs[TXV_BALANCE_B_B_WEIGHTAMM] = state.accountB.balanceB.weightAMM;

        aOutputs[TXV_ACCOUNT_B_ADDRESS] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[TXV_ACCOUNT_B_OWNER] = state.accountB.account.owner;
        uOutputs[TXV_ACCOUNT_B_PUBKEY_X] = state.accountB.account.publicKey.x;
        uOutputs[TXV_ACCOUNT_B_PUBKEY_Y] = state.accountB.account.publicKey.y;
        uOutputs[TXV_ACCOUNT_B_NONCE] = state.accountB.account.nonce;

        uOutputs[TXV_BALANCE_P_A_BALANCE] = state.pool.balanceA.balance;
        uOutputs[TXV_BALANCE_P_B_BALANCE] = state.pool.balanceB.balance;

        uOutputs[TXV_BALANCE_O_A_BALANCE] = state.oper.balanceA.balance;
        uOutputs[TXV_BALANCE_O_B_BALANCE] = state.oper.balanceB.balance;

        uOutputs[TXV_HASH_A] = state.constants._0;
        uOutputs[TXV_PUBKEY_X_A] = state.accountA.account.publicKey.x;
        uOutputs[TXV_PUBKEY_Y_A] = state.accountA.account.publicKey.y;
        uOutputs[TXV_SIGNATURE_REQUIRED_A] = state.constants._1;

        uOutputs[TXV_HASH_B] = state.constants._0;
        uOutputs[TXV_PUBKEY_X_B] = state.accountB.account.publicKey.x;
        uOutputs[TXV_PUBKEY_Y_B] = state.accountB.account.publicKey.y;
        uOutputs[TXV_SIGNATURE_REQUIRED_B] = state.constants._1;

        uOutputs[TXV_NUM_CONDITIONAL_TXS] = state.numConditionalTransactions;
    }

    const VariableT &getOutput(TxVariable txVariable) const
    {
        return uOutputs.at(txVariable);
    }

    const VariableArrayT &getArrayOutput(TxVariable txVariable) const
    {
        return aOutputs.at(txVariable);
    }

    void setOutput(TxVariable txVariable, const VariableT &var)
    {
        assert(uOutputs.find(txVariable) != uOutputs.end());
        uOutputs[txVariable] = var;
    }

    void setArrayOutput(TxVariable txVariable, const VariableArrayT &var)
    {
        assert(aOutputs.find(txVariable) != aOutputs.end());
        aOutputs[txVariable] = var;
    }

    virtual const VariableArrayT getPublicData() const = 0;
};

} // namespace Loopring

#endif