// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _UNIVERSALCIRCUIT_H_
#define _UNIVERSALCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/MatchingGadgets.h"
#include "../Gadgets/AccountGadgets.h"
#include "../Gadgets/StorageGadgets.h"
#include "../Gadgets/MathGadgets.h"
#include "./BaseTransactionCircuit.h"
#include "./DepositCircuit.h"
#include "./TransferCircuit.h"
#include "./SpotTradeCircuit.h"
#include "./AccountUpdateCircuit.h"
#include "./WithdrawCircuit.h"
#include "./NoopCircuit.h"
#include "./AmmUpdateCircuit.h"
#include "./SignatureVerificationCircuit.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

// Naming conventions:
// - O: operator
// - P: prrotocol fee
// - S：sell (send)
// - B: buy (receive)
// - A/B: tokens/accounts that are not equal

namespace Loopring
{

class SelectTransactionGadget : public BaseTransactionCircuit
{
  public:
    std::vector<SelectGadget> uSelects;
    std::vector<ArraySelectGadget> aSelects;
    std::vector<ArraySelectGadget> publicDataSelects;

    SelectTransactionGadget(
      ProtoboardT &pb,
      const TransactionState &state,
      const VariableArrayT &selector,
      const std::vector<BaseTransactionCircuit *> &transactions,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix)
    {
        assert(selector.size() == transactions.size());

        // Unsigned outputs
        uSelects.reserve(uOutputs.size());
        for (const auto &uPair : uOutputs)
        {
            std::vector<VariableT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                variables.push_back(transactions[i]->getOutput(uPair.first));
            }
            uSelects.emplace_back(pb, state.constants, selector, variables, FMT(annotation_prefix, ".uSelects"));

            // Set the output variable
            setOutput(uPair.first, uSelects.back().result());
        }

        // Array outputs
        aSelects.reserve(aOutputs.size());
        for (const auto &aPair : aOutputs)
        {
            std::vector<VariableArrayT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                variables.push_back(transactions[i]->getArrayOutput(aPair.first));
            }
            aSelects.emplace_back(pb, state.constants, selector, variables, FMT(annotation_prefix, ".aSelects"));

            // Set the output variable
            setArrayOutput(aPair.first, aSelects.back().result());
        }

        // Public data
        {
            std::vector<VariableArrayT> variables;
            for (unsigned int i = 0; i < transactions.size(); i++)
            {
                VariableArrayT da = transactions[i]->getPublicData();
                assert(da.size() <= (TX_DATA_AVAILABILITY_SIZE - 1) * 8);
                // Pad with zeros if needed
                for (unsigned int j = da.size(); j < (TX_DATA_AVAILABILITY_SIZE - 1) * 8; j++)
                {
                    da.emplace_back(state.constants._0);
                }
                variables.push_back(da);
                // std::cout << "da size: " << variables.back().size() << std::endl;
            }
            publicDataSelects.emplace_back(
              pb, state.constants, selector, variables, FMT(annotation_prefix, ".publicDataSelects"));
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < uSelects.size(); i++)
        {
            uSelects[i].generate_r1cs_witness();
        }
        for (unsigned int i = 0; i < aSelects.size(); i++)
        {
            aSelects[i].generate_r1cs_witness();
        }
        for (unsigned int i = 0; i < publicDataSelects.size(); i++)
        {
            publicDataSelects[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < uSelects.size(); i++)
        {
            uSelects[i].generate_r1cs_constraints();
        }
        for (unsigned int i = 0; i < aSelects.size(); i++)
        {
            aSelects[i].generate_r1cs_constraints();
        }
        for (unsigned int i = 0; i < publicDataSelects.size(); i++)
        {
            publicDataSelects[i].generate_r1cs_constraints();
        }
    }

    const VariableArrayT getPublicData() const
    {
        return publicDataSelects.back().result();
    }
};

class TransactionGadget : public GadgetT
{
  public:
    const Constants &constants;

    DualVariableGadget type;
    SelectorGadget selector;

    TransactionState state;

    // Process transaction
    NoopCircuit noop;
    SpotTradeCircuit spotTrade;
    DepositCircuit deposit;
    WithdrawCircuit withdraw;
    AccountUpdateCircuit accountUpdate;
    TransferCircuit transfer;
    AmmUpdateCircuit ammUpdate;
    SignatureVerificationCircuit signatureVerification;
    SelectTransactionGadget tx;

    // General validation
    FromBitsGadget accountA;
    FromBitsGadget accountB;
    RequireNotZeroGadget validateAccountA;
    RequireNotZeroGadget validateAccountB;

    // Check signatures
    SignatureVerifier signatureVerifierA;
    SignatureVerifier signatureVerifierB;

    // Update UserA
    UpdateStorageGadget updateStorage_A;
    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    UpdateAccountGadget updateAccount_A;

    // Update UserB
    UpdateStorageGadget updateStorage_B;
    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    UpdateAccountGadget updateAccount_B;

    // Update Operator
    UpdateBalanceGadget updateBalanceB_O;
    UpdateBalanceGadget updateBalanceA_O;
    UpdateAccountGadget updateAccount_O;

    // Update Protocol pool
    UpdateBalanceGadget updateBalanceB_P;
    UpdateBalanceGadget updateBalanceA_P;

    TransactionGadget(
      ProtoboardT &pb,
      const jubjub::Params &params,
      const Constants &_constants,
      const VariableT &exchange,
      const VariableT &accountsRoot,
      const VariableT &timestamp,
      const VariableT &protocolTakerFeeBips,
      const VariableT &protocolMakerFeeBips,
      const VariableArrayT &operatorAccountID,
      const VariableT &protocolBalancesRoot,
      const VariableT &numConditionalTransactionsBefore,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          constants(_constants),

          type(pb, NUM_BITS_TX_TYPE, FMT(prefix, ".type")),
          selector(pb, constants, type.packed, (unsigned int)TransactionType::COUNT, FMT(prefix, ".selector")),

          state(
            pb,
            params,
            constants,
            exchange,
            timestamp,
            protocolTakerFeeBips,
            protocolMakerFeeBips,
            numConditionalTransactionsBefore,
            type.packed,
            FMT(prefix, ".transactionState")),

          // Process transaction
          noop(pb, state, FMT(prefix, ".noop")),
          spotTrade(pb, state, FMT(prefix, ".spotTrade")),
          deposit(pb, state, FMT(prefix, ".deposit")),
          withdraw(pb, state, FMT(prefix, ".withdraw")),
          accountUpdate(pb, state, FMT(prefix, ".accountUpdate")),
          transfer(pb, state, FMT(prefix, ".transfer")),
          ammUpdate(pb, state, FMT(prefix, ".ammUpdate")),
          signatureVerification(pb, state, FMT(prefix, ".signatureVerification")),
          tx(
            pb,
            state,
            selector.result(),
            {&noop, &deposit, &withdraw, &transfer, &spotTrade, &accountUpdate, &ammUpdate, &signatureVerification},
            FMT(prefix, ".tx")),

          // General validation
          accountA(pb, tx.getArrayOutput(TXV_ACCOUNT_A_ADDRESS), FMT(prefix, ".packAccountA")),
          accountB(pb, tx.getArrayOutput(TXV_ACCOUNT_B_ADDRESS), FMT(prefix, ".packAccountA")),
          validateAccountA(pb, accountA.packed, FMT(prefix, ".validateAccountA")),
          validateAccountB(pb, accountB.packed, FMT(prefix, ".validateAccountB")),

          // Check signatures
          signatureVerifierA(
            pb,
            params,
            state.constants,
            jubjub::VariablePointT(tx.getOutput(TXV_PUBKEY_X_A), tx.getOutput(TXV_PUBKEY_Y_A)),
            tx.getOutput(TXV_HASH_A),
            tx.getOutput(TXV_SIGNATURE_REQUIRED_A),
            FMT(prefix, ".signatureVerifierA")),
          signatureVerifierB(
            pb,
            params,
            state.constants,
            jubjub::VariablePointT(tx.getOutput(TXV_PUBKEY_X_B), tx.getOutput(TXV_PUBKEY_Y_B)),
            tx.getOutput(TXV_HASH_B),
            tx.getOutput(TXV_SIGNATURE_REQUIRED_B),
            FMT(prefix, ".signatureVerifierB")),

          // Update UserA
          updateStorage_A(
            pb,
            state.accountA.balanceS.storageRoot,
            tx.getArrayOutput(TXV_STORAGE_A_ADDRESS),
            {state.accountA.storage.data, state.accountA.storage.storageID},
            {tx.getOutput(TXV_STORAGE_A_DATA), tx.getOutput(TXV_STORAGE_A_STORAGEID)},
            FMT(prefix, ".updateStorage_A")),
          updateBalanceS_A(
            pb,
            state.accountA.account.balancesRoot,
            tx.getArrayOutput(TXV_BALANCE_A_S_ADDRESS),
            {state.accountA.balanceS.balance, state.accountA.balanceS.weightAMM, state.accountA.balanceS.storageRoot},
            {tx.getOutput(TXV_BALANCE_A_S_BALANCE), tx.getOutput(TXV_BALANCE_A_S_WEIGHTAMM), updateStorage_A.result()},
            FMT(prefix, ".updateBalanceS_A")),
          updateBalanceB_A(
            pb,
            updateBalanceS_A.result(),
            tx.getArrayOutput(TXV_BALANCE_B_S_ADDRESS),
            {state.accountA.balanceB.balance, state.accountA.balanceB.weightAMM, state.accountA.balanceB.storageRoot},
            {tx.getOutput(TXV_BALANCE_A_B_BALANCE),
             state.accountA.balanceB.weightAMM,
             state.accountA.balanceB.storageRoot},
            FMT(prefix, ".updateBalanceB_A")),
          updateAccount_A(
            pb,
            accountsRoot,
            tx.getArrayOutput(TXV_ACCOUNT_A_ADDRESS),
            {state.accountA.account.owner,
             state.accountA.account.publicKey.x,
             state.accountA.account.publicKey.y,
             state.accountA.account.nonce,
             state.accountA.account.feeBipsAMM,
             state.accountA.account.balancesRoot},
            {tx.getOutput(TXV_ACCOUNT_A_OWNER),
             tx.getOutput(TXV_ACCOUNT_A_PUBKEY_X),
             tx.getOutput(TXV_ACCOUNT_A_PUBKEY_Y),
             tx.getOutput(TXV_ACCOUNT_A_NONCE),
             tx.getOutput(TXV_ACCOUNT_A_FEEBIPSAMM),
             updateBalanceB_A.result()},
            FMT(prefix, ".updateAccount_A")),

          // Update UserB
          updateStorage_B(
            pb,
            state.accountB.balanceS.storageRoot,
            tx.getArrayOutput(TXV_STORAGE_B_ADDRESS),
            {state.accountB.storage.data, state.accountB.storage.storageID},
            {tx.getOutput(TXV_STORAGE_B_DATA), tx.getOutput(TXV_STORAGE_B_STORAGEID)},
            FMT(prefix, ".updateStorage_B")),
          updateBalanceS_B(
            pb,
            state.accountB.account.balancesRoot,
            tx.getArrayOutput(TXV_BALANCE_B_S_ADDRESS),
            {state.accountB.balanceS.balance, state.accountB.balanceS.weightAMM, state.accountB.balanceS.storageRoot},
            {tx.getOutput(TXV_BALANCE_B_S_BALANCE), state.accountB.balanceS.weightAMM, updateStorage_B.result()},
            FMT(prefix, ".updateBalanceS_B")),
          updateBalanceB_B(
            pb,
            updateBalanceS_B.result(),
            tx.getArrayOutput(TXV_BALANCE_A_S_ADDRESS),
            {state.accountB.balanceB.balance, state.accountB.balanceB.weightAMM, state.accountB.balanceB.storageRoot},
            {tx.getOutput(TXV_BALANCE_B_B_BALANCE),
             state.accountB.balanceB.weightAMM,
             state.accountB.balanceB.storageRoot},
            FMT(prefix, ".updateBalanceB_B")),
          updateAccount_B(
            pb,
            updateAccount_A.result(),
            tx.getArrayOutput(TXV_ACCOUNT_B_ADDRESS),
            {state.accountB.account.owner,
             state.accountB.account.publicKey.x,
             state.accountB.account.publicKey.y,
             state.accountB.account.nonce,
             state.accountB.account.feeBipsAMM,
             state.accountB.account.balancesRoot},
            {tx.getOutput(TXV_ACCOUNT_B_OWNER),
             tx.getOutput(TXV_ACCOUNT_B_PUBKEY_X),
             tx.getOutput(TXV_ACCOUNT_B_PUBKEY_Y),
             tx.getOutput(TXV_ACCOUNT_B_NONCE),
             state.accountB.account.feeBipsAMM,
             updateBalanceB_B.result()},
            FMT(prefix, ".updateAccount_B")),

          // Update Operator
          updateBalanceB_O(
            pb,
            state.oper.account.balancesRoot,
            tx.getArrayOutput(TXV_BALANCE_A_S_ADDRESS),
            {state.oper.balanceB.balance, state.oper.balanceB.weightAMM, state.oper.balanceB.storageRoot},
            {tx.getOutput(TXV_BALANCE_O_B_BALANCE), state.oper.balanceB.weightAMM, state.oper.balanceB.storageRoot},
            FMT(prefix, ".updateBalanceB_O")),
          updateBalanceA_O(
            pb,
            updateBalanceB_O.result(),
            tx.getArrayOutput(TXV_BALANCE_B_S_ADDRESS),
            {state.oper.balanceA.balance, state.oper.balanceA.weightAMM, state.oper.balanceA.storageRoot},
            {tx.getOutput(TXV_BALANCE_O_A_BALANCE), state.oper.balanceA.weightAMM, state.oper.balanceA.storageRoot},
            FMT(prefix, ".updateBalanceA_O")),
          updateAccount_O(
            pb,
            updateAccount_B.result(),
            operatorAccountID,
            {state.oper.account.owner,
             state.oper.account.publicKey.x,
             state.oper.account.publicKey.y,
             state.oper.account.nonce,
             state.oper.account.feeBipsAMM,
             state.oper.account.balancesRoot},
            {state.oper.account.owner,
             state.oper.account.publicKey.x,
             state.oper.account.publicKey.y,
             state.oper.account.nonce,
             state.oper.account.feeBipsAMM,
             updateBalanceA_O.result()},
            FMT(prefix, ".updateAccount_O")),

          // Update Protocol pool
          updateBalanceB_P(
            pb,
            protocolBalancesRoot,
            tx.getArrayOutput(TXV_BALANCE_A_S_ADDRESS),
            {state.pool.balanceB.balance, state.pool.balanceB.weightAMM, state.pool.balanceB.storageRoot},
            {tx.getOutput(TXV_BALANCE_P_B_BALANCE), state.pool.balanceB.weightAMM, state.pool.balanceB.storageRoot},
            FMT(prefix, ".updateBalanceB_P")),
          updateBalanceA_P(
            pb,
            updateBalanceB_P.result(),
            tx.getArrayOutput(TXV_BALANCE_B_S_ADDRESS),
            {state.pool.balanceA.balance, state.pool.balanceA.weightAMM, state.pool.balanceA.storageRoot},
            {tx.getOutput(TXV_BALANCE_P_A_BALANCE), state.pool.balanceA.weightAMM, state.pool.balanceA.storageRoot},
            FMT(prefix, ".updateBalanceA_P"))

    {
    }

    void generate_r1cs_witness(const UniversalTransaction &uTx)
    {
        type.generate_r1cs_witness(pb, uTx.type);
        selector.generate_r1cs_witness();

        state.generate_r1cs_witness(
          uTx.witness.accountUpdate_A.before,
          uTx.witness.balanceUpdateS_A.before,
          uTx.witness.balanceUpdateB_A.before,
          uTx.witness.storageUpdate_A.before,
          uTx.witness.accountUpdate_B.before,
          uTx.witness.balanceUpdateS_B.before,
          uTx.witness.balanceUpdateB_B.before,
          uTx.witness.storageUpdate_B.before,
          uTx.witness.accountUpdate_O.before,
          uTx.witness.balanceUpdateA_O.before,
          uTx.witness.balanceUpdateB_O.before,
          uTx.witness.balanceUpdateA_P.before,
          uTx.witness.balanceUpdateB_P.before);

        noop.generate_r1cs_witness();
        spotTrade.generate_r1cs_witness(uTx.spotTrade);
        deposit.generate_r1cs_witness(uTx.deposit);
        withdraw.generate_r1cs_witness(uTx.withdraw);
        accountUpdate.generate_r1cs_witness(uTx.accountUpdate);
        transfer.generate_r1cs_witness(uTx.transfer);
        ammUpdate.generate_r1cs_witness(uTx.ammUpdate);
        signatureVerification.generate_r1cs_witness(uTx.signatureVerification);
        tx.generate_r1cs_witness();

        // General validation
        accountA.generate_r1cs_witness();
        accountB.generate_r1cs_witness();
        validateAccountA.generate_r1cs_witness();
        validateAccountB.generate_r1cs_witness();

        // Check signatures
        signatureVerifierA.generate_r1cs_witness(uTx.witness.signatureA);
        signatureVerifierB.generate_r1cs_witness(uTx.witness.signatureB);

        // Update UserA
        updateStorage_A.generate_r1cs_witness(uTx.witness.storageUpdate_A);
        updateBalanceS_A.generate_r1cs_witness(uTx.witness.balanceUpdateS_A);
        updateBalanceB_A.generate_r1cs_witness(uTx.witness.balanceUpdateB_A);
        updateAccount_A.generate_r1cs_witness(uTx.witness.accountUpdate_A);

        // Update UserB
        updateStorage_B.generate_r1cs_witness(uTx.witness.storageUpdate_B);
        updateBalanceS_B.generate_r1cs_witness(uTx.witness.balanceUpdateS_B);
        updateBalanceB_B.generate_r1cs_witness(uTx.witness.balanceUpdateB_B);
        updateAccount_B.generate_r1cs_witness(uTx.witness.accountUpdate_B);

        // Update Operator
        updateBalanceB_O.generate_r1cs_witness(uTx.witness.balanceUpdateB_O);
        updateBalanceA_O.generate_r1cs_witness(uTx.witness.balanceUpdateA_O);
        updateAccount_O.generate_r1cs_witness(uTx.witness.accountUpdate_O);

        // Update Protocol pool
        updateBalanceB_P.generate_r1cs_witness(uTx.witness.balanceUpdateB_P);
        updateBalanceA_P.generate_r1cs_witness(uTx.witness.balanceUpdateA_P);
    }

    void generate_r1cs_constraints()
    {
        type.generate_r1cs_constraints(true);
        selector.generate_r1cs_constraints();

        noop.generate_r1cs_constraints();
        spotTrade.generate_r1cs_constraints();
        deposit.generate_r1cs_constraints();
        withdraw.generate_r1cs_constraints();
        accountUpdate.generate_r1cs_constraints();
        transfer.generate_r1cs_constraints();
        ammUpdate.generate_r1cs_constraints();
        signatureVerification.generate_r1cs_constraints();
        tx.generate_r1cs_constraints();

        // General validation
        accountA.generate_r1cs_constraints();
        accountB.generate_r1cs_constraints();
        validateAccountA.generate_r1cs_constraints();
        validateAccountB.generate_r1cs_constraints();

        // Check signatures
        signatureVerifierA.generate_r1cs_constraints();
        signatureVerifierB.generate_r1cs_constraints();

        // Update UserA
        updateStorage_A.generate_r1cs_constraints();
        updateBalanceS_A.generate_r1cs_constraints();
        updateBalanceB_A.generate_r1cs_constraints();
        updateAccount_A.generate_r1cs_constraints();

        // Update UserB
        updateStorage_B.generate_r1cs_constraints();
        updateBalanceS_B.generate_r1cs_constraints();
        updateBalanceB_B.generate_r1cs_constraints();
        updateAccount_B.generate_r1cs_constraints();

        // Update Operator
        updateBalanceB_O.generate_r1cs_constraints();
        updateBalanceA_O.generate_r1cs_constraints();
        updateAccount_O.generate_r1cs_constraints();

        // Update Protocol fee pool
        updateBalanceB_P.generate_r1cs_constraints();
        updateBalanceA_P.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flatten({reverse(type.bits), tx.getPublicData()});
    }

    const VariableT &getNewAccountsRoot() const
    {
        return updateAccount_O.result();
    }

    const VariableT &getNewProtocolBalancesRoot() const
    {
        return updateBalanceA_P.result();
    }
};

class UniversalCircuit : public Circuit
{
  public:
    PublicDataGadget publicData;
    Constants constants;
    jubjub::Params params;

    // State
    AccountGadget accountBefore_P;
    AccountGadget accountBefore_O;

    // Inputs
    DualVariableGadget exchange;
    DualVariableGadget merkleRootBefore;
    DualVariableGadget merkleRootAfter;
    DualVariableGadget timestamp;
    DualVariableGadget protocolTakerFeeBips;
    DualVariableGadget protocolMakerFeeBips;
    std::unique_ptr<ToBitsGadget> numConditionalTransactions;
    DualVariableGadget operatorAccountID;

    // Increment the nonce of the Operator
    AddGadget nonce_after;

    // Signature
    Poseidon_2 hash;
    SignatureVerifier signatureVerifier;

    // Transactions
    unsigned int numTransactions;
    std::vector<TransactionGadget> transactions;

    // Update Protocol pool
    std::unique_ptr<UpdateAccountGadget> updateAccount_P;

    // Update Operator
    std::unique_ptr<UpdateAccountGadget> updateAccount_O;

    UniversalCircuit( //
      ProtoboardT &pb,
      const std::string &prefix)
        : Circuit(pb, prefix),

          publicData(pb, FMT(prefix, ".publicData")),
          constants(pb, FMT(prefix, ".constants")),

          // State
          accountBefore_P(pb, FMT(prefix, ".accountBefore_P")),
          accountBefore_O(pb, FMT(prefix, ".accountBefore_O")),

          // Inputs
          exchange(pb, NUM_BITS_ADDRESS, FMT(prefix, ".exchange")),
          merkleRootBefore(pb, 256, FMT(prefix, ".merkleRootBefore")),
          merkleRootAfter(pb, 256, FMT(prefix, ".merkleRootAfter")),
          timestamp(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".timestamp")),
          protocolTakerFeeBips(pb, NUM_BITS_PROTOCOL_FEE_BIPS, FMT(prefix, ".protocolTakerFeeBips")),
          protocolMakerFeeBips(pb, NUM_BITS_PROTOCOL_FEE_BIPS, FMT(prefix, ".protocolMakerFeeBips")),
          operatorAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".operatorAccountID")),

          // Increment the nonce of the Operator
          nonce_after(pb, accountBefore_O.nonce, constants._1, NUM_BITS_NONCE, FMT(prefix, ".nonce_after")),

          // Signature
          hash(pb, var_array({publicData.publicInput, accountBefore_O.nonce}), FMT(this->annotation_prefix, ".hash")),
          signatureVerifier(
            pb,
            params,
            constants,
            accountBefore_O.publicKey,
            hash.result(),
            constants._1,
            FMT(prefix, ".signatureVerifier"))
    {
    }

    void generateConstraints(unsigned int blockSize) override
    {
        this->numTransactions = blockSize;

        constants.generate_r1cs_constraints();

        // Inputs
        exchange.generate_r1cs_constraints(true);
        merkleRootBefore.generate_r1cs_constraints(true);
        merkleRootAfter.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);
        protocolTakerFeeBips.generate_r1cs_constraints(true);
        protocolMakerFeeBips.generate_r1cs_constraints(true);
        operatorAccountID.generate_r1cs_constraints(true);

        // Increment the nonce of the Operator
        nonce_after.generate_r1cs_constraints();

        // Transactions
        transactions.reserve(numTransactions);
        for (size_t j = 0; j < numTransactions; j++)
        {
            std::cout << "------------------- tx: " << j << std::endl;
            const VariableT txAccountsRoot =
              (j == 0) ? merkleRootBefore.packed : transactions.back().getNewAccountsRoot();
            const VariableT &txProtocolBalancesRoot =
              (j == 0) ? accountBefore_P.balancesRoot : transactions.back().getNewProtocolBalancesRoot();
            transactions.emplace_back(
              pb,
              params,
              constants,
              exchange.packed,
              txAccountsRoot,
              timestamp.packed,
              protocolTakerFeeBips.packed,
              protocolMakerFeeBips.packed,
              operatorAccountID.bits,
              txProtocolBalancesRoot,
              (j == 0) ? constants._0 : transactions.back().tx.getOutput(TXV_NUM_CONDITIONAL_TXS),
              std::string("tx_") + std::to_string(j));
            transactions.back().generate_r1cs_constraints();
        }

        // Update Protocol pool
        updateAccount_P.reset(new UpdateAccountGadget(
          pb,
          transactions.back().getNewAccountsRoot(),
          constants.zeroAccount,
          {accountBefore_P.owner,
           accountBefore_P.publicKey.x,
           accountBefore_P.publicKey.y,
           accountBefore_P.nonce,
           accountBefore_P.feeBipsAMM,
           accountBefore_P.balancesRoot},
          {accountBefore_P.owner,
           accountBefore_P.publicKey.x,
           accountBefore_P.publicKey.y,
           accountBefore_P.nonce,
           accountBefore_P.feeBipsAMM,
           transactions.back().getNewProtocolBalancesRoot()},
          FMT(annotation_prefix, ".updateAccount_P")));
        updateAccount_P->generate_r1cs_constraints();

        // Update Operator
        updateAccount_O.reset(new UpdateAccountGadget(
          pb,
          updateAccount_P->result(),
          operatorAccountID.bits,
          {accountBefore_O.owner,
           accountBefore_O.publicKey.x,
           accountBefore_O.publicKey.y,
           accountBefore_O.nonce,
           accountBefore_O.feeBipsAMM,
           accountBefore_O.balancesRoot},
          {accountBefore_O.owner,
           accountBefore_O.publicKey.x,
           accountBefore_O.publicKey.y,
           nonce_after.result(),
           accountBefore_O.feeBipsAMM,
           accountBefore_O.balancesRoot},
          FMT(annotation_prefix, ".updateAccount_O")));
        updateAccount_O->generate_r1cs_constraints();

        // Num conditional transactions
        numConditionalTransactions.reset(new ToBitsGadget(
          pb, transactions.back().tx.getOutput(TXV_NUM_CONDITIONAL_TXS), 32, ".numConditionalTransactions"));
        numConditionalTransactions->generate_r1cs_constraints();

        // Public data
        publicData.add(exchange.bits);
        publicData.add(merkleRootBefore.bits);
        publicData.add(merkleRootAfter.bits);
        publicData.add(timestamp.bits);
        publicData.add(protocolTakerFeeBips.bits);
        publicData.add(protocolMakerFeeBips.bits);
        publicData.add(numConditionalTransactions->bits);
        publicData.add(operatorAccountID.bits);
        unsigned int start = publicData.publicDataBits.size();
        for (size_t j = 0; j < numTransactions; j++)
        {
            publicData.add(reverse(transactions[j].getPublicData()));
        }
        publicData.transform(start, numTransactions, TX_DATA_AVAILABILITY_SIZE * 8);
        publicData.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();
        signatureVerifier.generate_r1cs_constraints();

        // Check the new merkle root
        requireEqual(pb, updateAccount_O->result(), merkleRootAfter.packed, "newMerkleRoot");
    }

    bool generateWitness(const Block &block)
    {
        if (block.transactions.size() != numTransactions)
        {
            std::cout << "Invalid number of transactions: " << block.transactions.size() << std::endl;
            return false;
        }

        constants.generate_r1cs_witness();

        // State
        accountBefore_P.generate_r1cs_witness(block.accountUpdate_P.before);
        accountBefore_O.generate_r1cs_witness(block.accountUpdate_O.before);

        // Inputs
        exchange.generate_r1cs_witness(pb, block.exchange);
        merkleRootBefore.generate_r1cs_witness(pb, block.merkleRootBefore);
        merkleRootAfter.generate_r1cs_witness(pb, block.merkleRootAfter);
        timestamp.generate_r1cs_witness(pb, block.timestamp);
        protocolTakerFeeBips.generate_r1cs_witness(pb, block.protocolTakerFeeBips);
        protocolMakerFeeBips.generate_r1cs_witness(pb, block.protocolMakerFeeBips);
        operatorAccountID.generate_r1cs_witness(pb, block.operatorAccountID);

        // Increment the nonce of the Operator
        nonce_after.generate_r1cs_witness();

        // Transactions
        // First set numConditionalTransactionsAfter which is a dependency between
        // transactions. Once this is set the transactions can be processed in
        // parallel.
        for (unsigned int i = 0; i < block.transactions.size(); i++)
        {
            pb.val(transactions[i].tx.getOutput(TXV_NUM_CONDITIONAL_TXS)) =
              block.transactions[i].witness.numConditionalTransactionsAfter;
        }
#ifdef MULTICORE
#pragma omp parallel for
#endif
        for (unsigned int i = 0; i < block.transactions.size(); i++)
        {
            // std::cout << "--------------- tx: " << i << " ( " <<
            // block.transactions[i].type << " ) " << std::endl;
            transactions[i].generate_r1cs_witness(block.transactions[i]);
        }

        // Update Protocol pool
        updateAccount_P->generate_r1cs_witness(block.accountUpdate_P);

        // Update Operator
        updateAccount_O->generate_r1cs_witness(block.accountUpdate_O);

        // Num conditional transactions
        numConditionalTransactions->generate_r1cs_witness_from_packed();

        // Public data
        publicData.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();
        signatureVerifier.generate_r1cs_witness(block.signature);

        return true;
    }

    bool generateWitness(const json &input) override
    {
        return generateWitness(input.get<Block>());
    }

    unsigned int getBlockType() override
    {
        return 0;
    }

    unsigned int getBlockSize() override
    {
        return numTransactions;
    }

    void printInfo() override
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numTransactions) << "/tx)"
                  << std::endl;
    }
};

} // namespace Loopring

#endif
