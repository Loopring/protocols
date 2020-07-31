// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _ACCOUNTTRANSFERCIRCUIT_H_
#define _ACCOUNTTRANSFERCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class AccountTransferCircuit : public BaseTransactionCircuit
{
public:

    // Inputs
    DualVariableGadget owner;
    DualVariableGadget accountID;
    DualVariableGadget validUntil;
    DualVariableGadget nonce;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget newOwner;
    DualVariableGadget walletHash;

    // Validate
    RequireLtGadget requireValidUntil;

    // Balances
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget balanceB_O;
    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;
    // Fee payment from From to the operator
    TransferGadget feePayment;

    // Increase the nonce
    AddGadget nonce_after;
    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    AccountTransferCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        owner(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
        nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        newOwner(pb, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
        walletHash(pb, state.accountA.account.walletHash, NUM_BITS_HASH, FMT(prefix, ".walletHash")),

        // Validate
        requireValidUntil(pb, state.timestamp, validUntil.packed, NUM_BITS_TIMESTAMP, FMT(prefix, ".requireValidUntil")),

        // Balances
        balanceS_A(pb, state.constants, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
        balanceB_O(pb, state.constants, state.oper.balanceB, FMT(prefix, ".balanceB_O")),
        // Fee as float
        fFee(pb, state.constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),
        // Fee payment from to the operator
        feePayment(pb, balanceS_A, balanceB_O, fFee.value(), FMT(prefix, ".feePayment")),

        // Increase the nonce
        nonce_after(pb, state.accountA.account.nonce, state.constants._1, NUM_BITS_NONCE, FMT(prefix, ".nonce_after")),
        // Increase the number of conditional transactions
        numConditionalTransactionsAfter(pb, state.numConditionalTransactions, state.constants._1, FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        // Update the account owner
        setArrayOutput(accountA_Address, accountID.bits);
        setOutput(accountA_Owner, newOwner.packed);
        setOutput(accountA_PublicKeyX, state.constants._0);
        setOutput(accountA_PublicKeyY, state.constants._0);
        setOutput(accountA_WalletHash, state.constants._0);
        setOutput(accountA_Nonce, nonce_after.result());

        // Update the account balance for the fee payment
        setArrayOutput(balanceA_S_Address, feeTokenID.bits);
        setOutput(balanceA_S_Balance, balanceS_A.balance());
        // Update the operator balance for the fee payment
        setOutput(balanceO_B_Balance, balanceB_O.balance());

        // No offchain signatures required
        setOutput(signatureRequired_A, state.constants._0);
        setOutput(signatureRequired_B, state.constants._0);

        // Increase the number of conditional transactions
        setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const AccountTransfer& change)
    {
        // Inputs
        owner.generate_r1cs_witness();
        accountID.generate_r1cs_witness(pb, change.accountID);
        validUntil.generate_r1cs_witness(pb, change.validUntil);
        nonce.generate_r1cs_witness();
        feeTokenID.generate_r1cs_witness(pb, change.feeTokenID);
        fee.generate_r1cs_witness(pb, change.fee);
        newOwner.generate_r1cs_witness(pb, change.newOwner);
        walletHash.generate_r1cs_witness();

        // Validate
        requireValidUntil.generate_r1cs_witness();

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_O.generate_r1cs_witness();
        // Fee as float
        fFee.generate_r1cs_witness(toFloat(change.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Fee payment from to the operator
        feePayment.generate_r1cs_witness();

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
        validUntil.generate_r1cs_constraints(true);
        nonce.generate_r1cs_constraints();
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        newOwner.generate_r1cs_constraints(true);
        walletHash.generate_r1cs_constraints(true);

        // Validate
        requireValidUntil.generate_r1cs_constraints();

        // Balances
        balanceS_A.generate_r1cs_constraints();
        balanceB_O.generate_r1cs_constraints();
        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();
        // Fee payment from to the operator
        feePayment.generate_r1cs_constraints();

        // Increase the nonce
        nonce_after.generate_r1cs_constraints();
        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({
            owner.bits,
            accountID.bits,
            VariableArrayT(4, state.constants._0), feeTokenID.bits,
            fFee.bits(),
            newOwner.bits,
            walletHash.bits,
            validUntil.bits,
            nonce.bits
        });
    }
};

}

#endif
