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

          storage(pb, FMT(prefix, ".storage")),   //
          balanceS(pb, FMT(prefix, ".balanceS")), //
          balanceB(pb, FMT(prefix, ".balanceB")), //
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

struct TransactionOperatorAccountState : public GadgetT
{
    BalanceGadget balanceA;
    BalanceGadget balanceB;
    AccountGadget account;

    TransactionOperatorAccountState(ProtoboardT &pb, const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")), //
          balanceB(pb, FMT(prefix, ".balanceB")), //
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

struct TransactionProtocolFeeAccountState : public GadgetT
{
    BalanceGadget balanceA;
    BalanceGadget balanceB;

    TransactionProtocolFeeAccountState(ProtoboardT &pb, const std::string &prefix)
        : GadgetT(pb, prefix),

          balanceA(pb, FMT(prefix, ".balanceA")), //
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
    TransactionOperatorAccountState operatorAccount;
    TransactionProtocolFeeAccountState protocolFeeAccount;

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

          constants(_constants), //

          exchange(_exchange),                                     //
          timestamp(_timestamp),                                   //
          protocolTakerFeeBips(_protocolTakerFeeBips),             //
          protocolMakerFeeBips(_protocolMakerFeeBips),             //
          numConditionalTransactions(_numConditionalTransactions), //
          type(_type),                                             //

          accountA(pb, FMT(prefix, ".accountA")),               //
          accountB(pb, FMT(prefix, ".accountB")),               //
          operatorAccount(pb, FMT(prefix, ".operatorAccount")), //
          protocolFeeAccount(pb, FMT(prefix, ".protocolFeeAccount"))
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
        operatorAccount.generate_r1cs_witness(account_O, balanceLeafA_O, balanceLeafB_O);
        protocolFeeAccount.generate_r1cs_witness(balanceLeafS_P, balanceLeafB_P);
    }
};

enum TxVariable
{
    STORAGE_A_ADDRESS,
    STORAGE_A_DATA,
    STORAGE_A_STORAGEID,

    BALANCE_A_S_ADDRESS,
    BALANCE_A_S_BALANCE,

    BALANCE_A_B_BALANCE,

    ACCOUNT_A_ADDRESS,
    ACCOUNT_A_OWNER,
    ACCOUNT_A_PUBKEY_X,
    ACCOUNT_A_PUBKEY_Y,
    ACCOUNT_A_NONCE,

    STORAGE_B_ADDRESS,
    STORAGE_B_DATA,
    STORAGE_B_STORAGEID,

    BALANCE_B_S_ADDRESS,
    BALANCE_B_S_BALANCE,

    BALANCE_B_B_BALANCE,

    ACCOUNT_B_ADDRESS,
    ACCOUNT_B_OWNER,
    ACCOUNT_B_PUBKEY_X,
    ACCOUNT_B_PUBKEY_Y,
    ACCOUNT_B_NONCE,

    BALANCE_P_A_BALANCE,
    BALANCE_P_B_BALANCE,

    BALANCE_O_A_BALANCE,
    BALANCE_O_B_BALANCE,

    HASH_A,
    PUBKEY_X_A,
    PUBKEY_Y_A,
    SIGNATURE_REQUIRED_A,

    HASH_B,
    PUBKEY_X_B,
    PUBKEY_Y_B,
    SIGNATURE_REQUIRED_B,

    NUM_CONDITIONAL_TXS
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
        aOutputs[STORAGE_A_ADDRESS] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[STORAGE_A_DATA] = state.accountA.storage.data;
        uOutputs[STORAGE_A_STORAGEID] = state.accountA.storage.storageID;

        aOutputs[BALANCE_A_S_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[BALANCE_A_S_BALANCE] = state.accountA.balanceS.balance;
        uOutputs[BALANCE_A_B_BALANCE] = state.accountA.balanceB.balance;

        aOutputs[ACCOUNT_A_ADDRESS] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[ACCOUNT_A_OWNER] = state.accountA.account.owner;
        uOutputs[ACCOUNT_A_PUBKEY_X] = state.accountA.account.publicKey.x;
        uOutputs[ACCOUNT_A_PUBKEY_Y] = state.accountA.account.publicKey.y;
        uOutputs[ACCOUNT_A_NONCE] = state.accountA.account.nonce;

        aOutputs[STORAGE_B_ADDRESS] = VariableArrayT(NUM_BITS_STORAGE_ADDRESS, state.constants._0);
        uOutputs[STORAGE_B_DATA] = state.accountB.storage.data;
        uOutputs[STORAGE_B_STORAGEID] = state.accountB.storage.storageID;

        aOutputs[BALANCE_B_S_ADDRESS] = VariableArrayT(NUM_BITS_TOKEN, state.constants._0);
        uOutputs[BALANCE_B_S_BALANCE] = state.accountB.balanceS.balance;
        uOutputs[BALANCE_B_B_BALANCE] = state.accountB.balanceB.balance;

        aOutputs[ACCOUNT_B_ADDRESS] =
          flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)});
        uOutputs[ACCOUNT_B_OWNER] = state.accountB.account.owner;
        uOutputs[ACCOUNT_B_PUBKEY_X] = state.accountB.account.publicKey.x;
        uOutputs[ACCOUNT_B_PUBKEY_Y] = state.accountB.account.publicKey.y;
        uOutputs[ACCOUNT_B_NONCE] = state.accountB.account.nonce;

        uOutputs[BALANCE_P_A_BALANCE] = state.protocolFeeAccount.balanceA.balance;
        uOutputs[BALANCE_P_B_BALANCE] = state.protocolFeeAccount.balanceB.balance;

        uOutputs[BALANCE_O_A_BALANCE] = state.operatorAccount.balanceA.balance;
        uOutputs[BALANCE_O_B_BALANCE] = state.operatorAccount.balanceB.balance;

        uOutputs[HASH_A] = state.constants._0;
        uOutputs[PUBKEY_X_A] = state.accountA.account.publicKey.x;
        uOutputs[PUBKEY_Y_A] = state.accountA.account.publicKey.y;
        uOutputs[SIGNATURE_REQUIRED_A] = state.constants._1;

        uOutputs[HASH_B] = state.constants._0;
        uOutputs[PUBKEY_X_B] = state.accountB.account.publicKey.x;
        uOutputs[PUBKEY_Y_B] = state.accountB.account.publicKey.y;
        uOutputs[SIGNATURE_REQUIRED_B] = state.constants._1;

        uOutputs[NUM_CONDITIONAL_TXS] = state.numConditionalTransactions;
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