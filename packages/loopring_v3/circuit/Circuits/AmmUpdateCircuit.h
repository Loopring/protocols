// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _AMMUPDATECIRCUIT_H_
#define _AMMUPDATECIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

// Updates the AMM fee bips and token weights for an account.
// Also makes a token balance of an account available in the data-availability data.
class AmmUpdateCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    ToBitsGadget owner;
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget feeBips;
    DualVariableGadget tokenWeight;
    ToBitsGadget nonce;
    ToBitsGadget balance;

    // Increase the nonce
    AddGadget nonce_after;
    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    AmmUpdateCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          owner(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
          feeBips(pb, NUM_BITS_AMM_BIPS, FMT(prefix, ".feeBips")),
          tokenWeight(pb, NUM_BITS_AMOUNT, FMT(prefix, ".tokenWeight")),
          nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
          balance(pb, state.accountA.balanceS.balance, NUM_BITS_AMOUNT, FMT(prefix, ".balance")),

          // Increase the nonce
          nonce_after(
            pb,
            state.accountA.account.nonce,
            state.constants._1,
            NUM_BITS_NONCE,
            FMT(prefix, ".nonce_after")),
          // Increase the number of conditional transactions
          numConditionalTransactionsAfter(
            pb,
            state.numConditionalTransactions,
            state.constants._1,
            FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, accountID.bits);
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, tokenID.bits);

        setOutput(TXV_ACCOUNT_A_NONCE, nonce_after.result());
        setOutput(TXV_ACCOUNT_A_FEEBIPSAMM, feeBips.packed);
        setOutput(TXV_BALANCE_A_S_WEIGHTAMM, tokenWeight.packed);

        // No signatures needed
        setOutput(TXV_SIGNATURE_REQUIRED_A, state.constants._0);
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);

        // Increase the number of conditional transactions
        setOutput(TXV_NUM_CONDITIONAL_TXS, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const AmmUpdate &update)
    {
        // Inputs
        owner.generate_r1cs_witness();
        accountID.generate_r1cs_witness(pb, update.accountID);
        tokenID.generate_r1cs_witness(pb, update.tokenID);
        feeBips.generate_r1cs_witness(pb, update.feeBips);
        tokenWeight.generate_r1cs_witness(pb, update.tokenWeight);
        nonce.generate_r1cs_witness();
        balance.generate_r1cs_witness();

        // Increase the nonce
        nonce_after.generate_r1cs_witness();
        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        owner.generate_r1cs_constraints();
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        feeBips.generate_r1cs_constraints(true);
        tokenWeight.generate_r1cs_constraints(true);
        nonce.generate_r1cs_constraints();
        balance.generate_r1cs_constraints();

        // Increase the nonce
        nonce_after.generate_r1cs_constraints();
        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse(
          {owner.bits, accountID.bits, tokenID.bits, feeBips.bits, tokenWeight.bits, nonce.bits, balance.bits});
    }
};

} // namespace Loopring

#endif
