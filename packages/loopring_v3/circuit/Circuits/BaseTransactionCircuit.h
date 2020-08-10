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

    TransactionAccountState(ProtoboardT &pb, const std::string &prefix)
        : GadgetT(pb, prefix),

          storage(pb, FMT(prefix, ".storage")), balanceS(pb, FMT(prefix, ".balanceS")),
          balanceB(pb, FMT(prefix, ".balanceB")), account(pb, FMT(prefix, ".account"))
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

    TransactionAccountOperatorState(ProtoboardT &pb, const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")), balanceB(pb, FMT(prefix, ".balanceB")),
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

    TransactionAccountBalancesState(ProtoboardT &pb, const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")), balanceB(pb, FMT(prefix, ".balanceB"))
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

          exchange(_exchange), timestamp(_timestamp), protocolTakerFeeBips(_protocolTakerFeeBips),
          protocolMakerFeeBips(_protocolMakerFeeBips), numConditionalTransactions(_numConditionalTransactions),
          type(_type),

          accountA(pb, FMT(prefix, ".accountA")), accountB(pb, FMT(prefix, ".accountB")),
          oper(pb, FMT(prefix, ".oper")), pool(pb, FMT(prefix, ".pool"))
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
    storageA_Address,
    storageA_Data,
    storageA_StorageId,

    balanceA_S_Address,
    balanceA_S_Balance,

    balanceA_B_Balance,

    accountA_Address,
    accountA_Owner,
    accountA_PublicKeyX,
    accountA_PublicKeyY,
    accountA_Nonce,

    storageB_Address,
    storageB_Data,
    storageB_StorageId,

    balanceB_S_Address,
    balanceB_S_Balance,

    balanceB_B_Balance,

    accountB_Address,
    accountB_Owner,
    accountB_PublicKeyX,
    accountB_PublicKeyY,
    accountB_Nonce,

    balanceP_A_Balance,
    balanceP_B_Balance,

    balanceO_A_Balance,
    balanceO_B_Balance,

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
    const TransactionState &state;

    std::map<TxVariable, VariableT> uOutputs;
    std::map<TxVariable, VariableArrayT> aOutputs;

    BaseTransactionCircuit(ProtoboardT &pb, const TransactionState &_state, const std::string &prefix)
        : GadgetT(pb, prefix), state(_state)
    {
        aOutputs[storageA_Address] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[storageA_Data] = state.accountA.storage.data;
        uOutputs[storageA_StorageId] = state.accountA.storage.storageID;

        aOutputs[balanceA_S_Address] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[balanceA_S_Balance] = state.accountA.balanceS.balance;

        uOutputs[balanceA_B_Balance] = state.accountA.balanceB.balance;

        aOutputs[accountA_Address] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[accountA_Owner] = state.accountA.account.owner;
        uOutputs[accountA_PublicKeyX] = state.accountA.account.publicKey.x;
        uOutputs[accountA_PublicKeyY] = state.accountA.account.publicKey.y;
        uOutputs[accountA_Nonce] = state.accountA.account.nonce;

        aOutputs[storageB_Address] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[storageB_Data] = state.accountB.storage.data;
        uOutputs[storageB_StorageId] = state.accountB.storage.storageID;

        aOutputs[balanceB_S_Address] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[balanceB_S_Balance] = state.accountB.balanceS.balance;

        uOutputs[balanceB_B_Balance] = state.accountB.balanceB.balance;

        aOutputs[accountB_Address] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[accountB_Owner] = state.accountB.account.owner;
        uOutputs[accountB_PublicKeyX] = state.accountB.account.publicKey.x;
        uOutputs[accountB_PublicKeyY] = state.accountB.account.publicKey.y;
        uOutputs[accountB_Nonce] = state.accountB.account.nonce;

        uOutputs[balanceP_A_Balance] = state.pool.balanceA.balance;
        uOutputs[balanceP_B_Balance] = state.pool.balanceB.balance;

        uOutputs[balanceO_A_Balance] = state.oper.balanceA.balance;
        uOutputs[balanceO_B_Balance] = state.oper.balanceB.balance;

        uOutputs[hash_A] = state.constants._0;
        uOutputs[publicKeyX_A] = state.accountA.account.publicKey.x;
        uOutputs[publicKeyY_A] = state.accountA.account.publicKey.y;
        uOutputs[signatureRequired_A] = state.constants._1;

        uOutputs[hash_B] = state.constants._0;
        uOutputs[publicKeyX_B] = state.accountB.account.publicKey.x;
        uOutputs[publicKeyY_B] = state.accountB.account.publicKey.y;
        uOutputs[signatureRequired_B] = state.constants._1;

        uOutputs[misc_NumConditionalTransactions] = state.numConditionalTransactions;
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