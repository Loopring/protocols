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

class AmmUpdateCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget owner;
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget feeBips;
    DualVariableGadget tokenWeight;
    DualVariableGadget balance;

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
          feeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".feeBips")),
          tokenWeight(pb, NUM_BITS_AMOUNT, FMT(prefix, ".tokenWeight")),
          balance(pb, state.accountA.balanceS.balance, NUM_BITS_AMOUNT, FMT(prefix, ".balance")),

          // Increase the number of conditional transactions
          numConditionalTransactionsAfter(
            pb,
            state.numConditionalTransactions,
            state.constants._1,
            FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, accountID.bits);
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, tokenID.bits);

        setOutput(TXV_ACCOUNT_A_FEEBIPSAMM, feeBips.packed);
        setOutput(TXV_BALANCE_A_S_WEIGHTAMM, tokenWeight.packed);

        // No singatures needed
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
        balance.generate_r1cs_witness();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        owner.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        feeBips.generate_r1cs_constraints(true);
        tokenWeight.generate_r1cs_constraints(true);
        balance.generate_r1cs_constraints(true);

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({
            owner.bits,
            accountID.bits,
            tokenID.bits,
            VariableArrayT(2, state.constants._0), feeBips.bits,
            tokenWeight.bits,
            balance.bits
        });
    }
};

} // namespace Loopring

#endif
