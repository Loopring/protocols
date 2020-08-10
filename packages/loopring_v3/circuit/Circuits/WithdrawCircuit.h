// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _OFFCHAINWITHDRAWALCIRCUIT_H_
#define _OFFCHAINWITHDRAWALCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"
#include "../Gadgets/AccountGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

// When withdrawing from the protocol fee pool account (account 0),
// account 1 is used as the main account (without side effects),
// the withdrawing is done using the optimized protocol pool
// balance update system.
// This is to ensure this operation does not update the protocol pool
// account leaf here, that account should only be modified once,
// and that is done a single time in a block.
class WithdrawCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget amount;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget validUntil;
    DualVariableGadget onchainDataHash;
    DualVariableGadget type;

    // Special case protocol fee withdrawal
    EqualGadget isProtocolFeeWithdrawal;
    TernaryGadget ownerValue;
    TernaryGadget nonceValue;
    DualVariableGadget owner;
    DualVariableGadget nonce;

    // Signature
    Poseidon_gadget_T<10, 1, 6, 53, 9, 1> hash;

    // Validate
    RequireLtGadget requireValidUntil;

    // Type
    IsNonZero isConditional;
    NotGadget needsSignature;

    // Balances
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget balanceB_P;

    // Check how much should be withdrawn
    TernaryGadget fullBalance;
    EqualGadget amountIsZero;
    EqualGadget amountIsFullBalance;
    EqualGadget validFullWithdrawalType;
    EqualGadget invalidFullWithdrawalType;
    IfThenRequireGadget checkValidFullWithdrawal;
    IfThenRequireGadget checkInvalidFullWithdrawal;

    // Fee balances
    DynamicBalanceGadget balanceB_A;
    DynamicBalanceGadget balanceA_O;
    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;
    // Fee payment from From to the operator
    TransferGadget feePayment;

    // Calculate the new balance
    TernaryGadget amountA;
    TernaryGadget amountP;
    SubGadget balanceA_after;
    SubGadget balanceP_after;
    ArrayTernaryGadget merkleTreeAccountA;

    // Increase the nonce of the user by 1
    OrGadget isForcedWithdrawal;
    NotGadget isNotForcedWithdrawal;
    AddGadget nonce_after;

    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    WithdrawCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
          amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
          feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
          fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
          validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
          onchainDataHash(pb, NUM_BITS_HASH, FMT(prefix, ".onchainDataHash")),
          type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),

          // Special case protocol fee withdrawal
          isProtocolFeeWithdrawal(pb, accountID.packed, state.constants._0, FMT(prefix, ".isProtocolFeeWithdrawal")),
          ownerValue(
            pb,
            isProtocolFeeWithdrawal.result(),
            state.constants._0,
            state.accountA.account.owner,
            FMT(prefix, ".ownerValue")),
          nonceValue(
            pb,
            isProtocolFeeWithdrawal.result(),
            state.constants._0,
            state.accountA.account.nonce,
            FMT(prefix, ".nonceValue")),
          owner(pb, ownerValue.result(), NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
          nonce(pb, nonceValue.result(), NUM_BITS_NONCE, FMT(prefix, ".nonce")),

          // Signature
          hash(
            pb,
            var_array(
              {state.exchange,
               accountID.packed,
               tokenID.packed,
               amount.packed,
               feeTokenID.packed,
               fee.packed,
               onchainDataHash.packed,
               validUntil.packed,
               state.accountA.account.nonce}),
            FMT(this->annotation_prefix, ".hash")),

          // Validate
          requireValidUntil(
            pb,
            state.timestamp,
            validUntil.packed,
            NUM_BITS_TIMESTAMP,
            FMT(prefix, ".requireValidUntil")),

          // Type
          isConditional(pb, type.packed, FMT(prefix, ".isConditional")),
          needsSignature(pb, isConditional.result(), FMT(prefix, ".needsSignature")),

          // Balances
          balanceS_A(pb, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
          balanceB_P(pb, state.pool.balanceB, FMT(prefix, ".balanceB_P")),

          // Check how much should be withdrawn
          fullBalance(
            pb,
            isProtocolFeeWithdrawal.result(),
            balanceB_P.balance(),
            balanceS_A.balance(),
            FMT(prefix, ".fullBalance")),
          amountIsZero(pb, amount.packed, state.constants._0, FMT(prefix, ".amountIsZero")),
          amountIsFullBalance(pb, amount.packed, fullBalance.result(), FMT(prefix, ".amountIsFullBalance")),
          validFullWithdrawalType(pb, type.packed, state.constants._2, FMT(prefix, ".validFullWithdrawalType")),
          invalidFullWithdrawalType(pb, type.packed, state.constants._3, FMT(prefix, ".invalidFullWithdrawalType")),
          checkValidFullWithdrawal(
            pb,
            validFullWithdrawalType.result(),
            amountIsFullBalance.result(),
            FMT(prefix, ".checkValidFullWithdrawal")),
          checkInvalidFullWithdrawal(
            pb,
            invalidFullWithdrawalType.result(),
            amountIsZero.result(),
            FMT(prefix, ".checkInvalidFullWithdrawal")),

          // Fee balances
          balanceB_A(pb, state.accountA.balanceB, FMT(prefix, ".balanceB_A")),
          balanceA_O(pb, state.oper.balanceA, FMT(prefix, ".balanceA_O")),
          // Fee as float
          fFee(pb, state.constants, Float16Encoding, FMT(prefix, ".fFee")),
          requireAccuracyFee(
            pb,
            fFee.value(),
            fee.packed,
            Float16Accuracy,
            NUM_BITS_AMOUNT,
            FMT(prefix, ".requireAccuracyFee")),
          // Fee payment from to the operator
          feePayment(pb, balanceB_A, balanceA_O, fFee.value(), FMT(prefix, ".feePayment")),

          // Calculate the new balance
          amountA(pb, isProtocolFeeWithdrawal.result(), state.constants._0, amount.packed, FMT(prefix, ".amountA")),
          amountP(pb, isProtocolFeeWithdrawal.result(), amount.packed, state.constants._0, FMT(prefix, ".amountP")),
          balanceA_after(pb, balanceS_A.balance(), amountA.result(), NUM_BITS_AMOUNT, FMT(prefix, ".balanceA_after")),
          balanceP_after(pb, balanceB_P.balance(), amountP.result(), NUM_BITS_AMOUNT, FMT(prefix, ".balanceP_after")),
          merkleTreeAccountA(
            pb,
            isProtocolFeeWithdrawal.result(),
            flatten({VariableArrayT(1, state.constants._1), VariableArrayT(NUM_BITS_ACCOUNT - 1, state.constants._0)}),
            accountID.bits,
            FMT(prefix, ".merkleTreeAccountA")),

          // Increase the nonce by 1 (unless it's a forced withdrawal)
          isForcedWithdrawal(
            pb,
            {validFullWithdrawalType.result(), invalidFullWithdrawalType.result()},
            FMT(prefix, ".isForcedWithdrawal")),
          isNotForcedWithdrawal(pb, isForcedWithdrawal.result(), FMT(prefix, ".isNotForcedWithdrawal")),
          nonce_after(
            pb,
            state.accountA.account.nonce,
            isNotForcedWithdrawal.result(),
            NUM_BITS_NONCE,
            FMT(prefix, ".nonce_after")),

          // Increase the number of conditional transactions
          numConditionalTransactionsAfter(
            pb,
            state.numConditionalTransactions,
            state.constants._1,
            FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        // Update the account owner
        setArrayOutput(accountA_Address, merkleTreeAccountA.result());
        setOutput(accountA_Nonce, nonce_after.result());

        // Update the account balances (withdrawal + fee)
        setArrayOutput(balanceA_S_Address, tokenID.bits);
        setOutput(balanceA_S_Balance, balanceA_after.result());
        setArrayOutput(balanceB_S_Address, feeTokenID.bits);
        setOutput(balanceA_B_Balance, balanceB_A.balance());

        // Update the protocol fee pool balance when withdrawing from the protocol
        // pool
        setOutput(balanceP_B_Balance, balanceP_after.result());

        // Update the operator balance for the fee payment
        setOutput(balanceO_A_Balance, balanceA_O.balance());

        // Verify a single signature of the account owner (if not conditional)
        setOutput(hash_A, hash.result());
        setOutput(signatureRequired_A, needsSignature.result());
        setOutput(signatureRequired_B, state.constants._0);

        // Increase the number of conditional transactions
        setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const Withdrawal &withdrawal)
    {
        // Inputs
        accountID.generate_r1cs_witness(pb, withdrawal.accountID);
        tokenID.generate_r1cs_witness(pb, withdrawal.tokenID);
        amount.generate_r1cs_witness(pb, withdrawal.amount);
        feeTokenID.generate_r1cs_witness(pb, withdrawal.feeTokenID);
        fee.generate_r1cs_witness(pb, withdrawal.fee);
        validUntil.generate_r1cs_witness(pb, withdrawal.validUntil);
        onchainDataHash.generate_r1cs_witness(pb, withdrawal.onchainDataHash);
        type.generate_r1cs_witness(pb, withdrawal.type);

        // Special case protocol fee withdrawal
        isProtocolFeeWithdrawal.generate_r1cs_witness();
        ownerValue.generate_r1cs_witness();
        nonceValue.generate_r1cs_witness();
        owner.generate_r1cs_witness();
        nonce.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();

        // Validate
        requireValidUntil.generate_r1cs_witness();

        // Type
        isConditional.generate_r1cs_witness();
        needsSignature.generate_r1cs_witness();

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_P.generate_r1cs_witness();

        // Check how much should be withdrawn
        fullBalance.generate_r1cs_witness();
        amountIsZero.generate_r1cs_witness();
        amountIsFullBalance.generate_r1cs_witness();
        validFullWithdrawalType.generate_r1cs_witness();
        invalidFullWithdrawalType.generate_r1cs_witness();
        checkValidFullWithdrawal.generate_r1cs_witness();
        checkInvalidFullWithdrawal.generate_r1cs_witness();

        // Fee balances
        balanceB_A.generate_r1cs_witness();
        balanceA_O.generate_r1cs_witness();
        // Fee as float
        fFee.generate_r1cs_witness(toFloat(withdrawal.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Fee payment from to the operator
        feePayment.generate_r1cs_witness();

        // Calculate the new balance
        amountA.generate_r1cs_witness();
        amountP.generate_r1cs_witness();
        balanceA_after.generate_r1cs_witness();
        balanceP_after.generate_r1cs_witness();
        merkleTreeAccountA.generate_r1cs_witness();

        // Increase the nonce by 1 (unless it's a forced withdrawal)
        isForcedWithdrawal.generate_r1cs_witness();
        isNotForcedWithdrawal.generate_r1cs_witness();
        nonce_after.generate_r1cs_witness();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        onchainDataHash.generate_r1cs_constraints(true);
        type.generate_r1cs_constraints(true);

        // Special case protocol fee withdrawal
        isProtocolFeeWithdrawal.generate_r1cs_constraints();
        ownerValue.generate_r1cs_constraints();
        nonceValue.generate_r1cs_constraints();
        owner.generate_r1cs_constraints(true);
        nonce.generate_r1cs_constraints(true);

        // Signature
        hash.generate_r1cs_constraints();

        // Validate
        requireValidUntil.generate_r1cs_constraints();

        // Type
        isConditional.generate_r1cs_constraints();
        needsSignature.generate_r1cs_constraints();

        // Balances
        balanceS_A.generate_r1cs_constraints();
        balanceB_P.generate_r1cs_constraints();

        // Check how much should be withdrawn
        fullBalance.generate_r1cs_constraints();
        amountIsZero.generate_r1cs_constraints();
        amountIsFullBalance.generate_r1cs_constraints();
        validFullWithdrawalType.generate_r1cs_constraints();
        invalidFullWithdrawalType.generate_r1cs_constraints();
        checkValidFullWithdrawal.generate_r1cs_constraints();
        checkInvalidFullWithdrawal.generate_r1cs_constraints();

        // Fee balances
        balanceB_A.generate_r1cs_constraints();
        balanceA_O.generate_r1cs_constraints();
        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();
        // Fee payment from to the operator
        feePayment.generate_r1cs_constraints();

        // Calculate the new balance
        amountA.generate_r1cs_constraints();
        amountP.generate_r1cs_constraints();
        balanceA_after.generate_r1cs_constraints();
        balanceP_after.generate_r1cs_constraints();
        merkleTreeAccountA.generate_r1cs_constraints();

        // Increase the nonce by 1 (unless it's a forced withdrawal)
        isForcedWithdrawal.generate_r1cs_constraints();
        isNotForcedWithdrawal.generate_r1cs_constraints();
        nonce_after.generate_r1cs_constraints();

        // Increase the number of conditional transactions
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse(
          {type.bits,
           owner.bits,
           accountID.bits,
           tokenID.bits,
           amount.bits,
           feeTokenID.bits,
           fFee.bits(),
           nonce.bits,
           onchainDataHash.bits});
    }
};

} // namespace Loopring

#endif
