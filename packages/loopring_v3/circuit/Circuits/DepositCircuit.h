// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _DEPOSITCIRCUIT_H_
#define _DEPOSITCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class DepositCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget owner;
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget amount;

    // Validate
    OwnerValidGadget ownerValid;

    // Calculate the new balance
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget depositedAmount;
    AddGadget balance_after;

    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    DepositCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          owner(pb, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
          amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),

          // Validate
          ownerValid(pb, state.constants, state.accountA.account.owner, owner.packed, FMT(prefix, ".ownerValid")),

          // Calculate the new balance
          balanceS_A(pb, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
          depositedAmount(pb, amount.packed, FMT(prefix, ".depositedAmount")),
          balance_after(
            pb,
            balanceS_A.balance(),
            depositedAmount.balance(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".balance_after")),

          // Increase the number of conditional transactions
          numConditionalTransactionsAfter(
            pb,
            state.numConditionalTransactions,
            state.constants._1,
            FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        // Update the account balance
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, accountID.bits);
        setOutput(TXV_ACCOUNT_A_OWNER, owner.packed);
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, tokenID.bits);
        setOutput(TXV_BALANCE_A_S_BALANCE, balance_after.result());

        // No signatures needed
        setOutput(TXV_SIGNATURE_REQUIRED_A, state.constants._0);
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);

        // Increase the number of conditional transactions
        setOutput(TXV_NUM_CONDITIONAL_TXS, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const Deposit &deposit)
    {
        // Inputs
        owner.generate_r1cs_witness(pb, deposit.owner);
        accountID.generate_r1cs_witness(pb, deposit.accountID);
        tokenID.generate_r1cs_witness(pb, deposit.tokenID);
        amount.generate_r1cs_witness(pb, deposit.amount);

        // Validate
        ownerValid.generate_r1cs_witness();

        // Calculate the new balance
        balanceS_A.generate_r1cs_witness();
        depositedAmount.generate_r1cs_witness();
        balance_after.generate_r1cs_witness();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        owner.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);

        // Validate
        ownerValid.generate_r1cs_constraints();

        // Calculate the new balance
        balanceS_A.generate_r1cs_constraints();
        depositedAmount.generate_r1cs_constraints();
        balance_after.generate_r1cs_constraints();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({owner.bits, accountID.bits, tokenID.bits, amount.bits});
    }
};

} // namespace Loopring

#endif
