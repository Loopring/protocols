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
    DualVariableGadget index;

    // Validate
    OwnerValidGadget ownerValid;

    // Calculate the new index
    MaxGadget newIndex;

    // Calculate the new balance
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget depositedAmount;
    AddGadget balance_after;

    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    DepositCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        owner(pb, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
        amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
        index(pb, NUM_BITS_AMOUNT, FMT(prefix, ".index")),

        // Validate
        ownerValid(pb, state.constants, state.accountA.account.owner, owner.packed, FMT(prefix, ".ownerValid")),

        // Calculate the new index
        newIndex(pb, index.packed, state.index.balanceB.index, NUM_BITS_AMOUNT, FMT(prefix, ".newIndex")),

        // Calculate the new balance
        balanceS_A(pb, state.constants, state.accountA.balanceS, newIndex.result(), FMT(prefix, ".balanceS_A")),
        depositedAmount(pb, state.constants, amount.packed, index.packed, newIndex.result(), FMT(prefix, ".depositedAmount")),
        balance_after(pb, balanceS_A.balance(), depositedAmount.balance(), NUM_BITS_AMOUNT, FMT(prefix, ".balance_after")),

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter(pb, state.numConditionalTransactions, state.constants.one, FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(accountA_Address, accountID.bits);
        setOutput(accountA_Owner, owner.packed);
        setArrayOutput(balanceA_S_Address, tokenID.bits);
        setOutput(balanceA_S_Balance, balance_after.result());
        setOutput(balanceA_S_Index, newIndex.result());

        setOutput(index_B, newIndex.result());

        setOutput(signatureRequired_A, state.constants.zero);
        setOutput(signatureRequired_B, state.constants.zero);

        setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        // Inputs
        owner.generate_r1cs_witness(pb, deposit.owner);
        accountID.generate_r1cs_witness(pb, deposit.accountID);
        tokenID.generate_r1cs_witness(pb, deposit.tokenID);
        amount.generate_r1cs_witness(pb, deposit.amount);
        index.generate_r1cs_witness(pb, deposit.index);

        // Validate
        ownerValid.generate_r1cs_witness();

        // Calculate the new index
        newIndex.generate_r1cs_witness();

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
        index.generate_r1cs_constraints(true);

        // Validate
        ownerValid.generate_r1cs_constraints();

        // Calculate the new index
        newIndex.generate_r1cs_constraints();

        // Calculate the new balance
        balanceS_A.generate_r1cs_constraints();
        depositedAmount.generate_r1cs_constraints();
        balance_after.generate_r1cs_constraints();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({
            owner.bits,
            accountID.bits,
            VariableArrayT(4, state.constants.zero), tokenID.bits,
            amount.bits,
            index.bits
        });
    }
};

}

#endif
