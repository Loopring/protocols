// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _ACCOUNTUPDATECIRCUIT_H_
#define _ACCOUNTUPDATECIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

#include "../Gadgets/SignatureGadgets.h"

using namespace ethsnarks;

namespace Loopring
{

class AccountUpdateCircuit : public BaseTransactionCircuit
{
public:
  // Inputs
  DualVariableGadget owner;
  DualVariableGadget accountID;
  DualVariableGadget validUntil;
  DualVariableGadget nonce;
  VariableT publicKeyX;
  VariableT publicKeyY;
  DualVariableGadget feeTokenID;
  DualVariableGadget fee;
  DualVariableGadget type;

  // Signature
  Poseidon_gadget_T<9, 1, 6, 53, 8, 1> hash;

  // Validate
  RequireLtGadget requireValidUntil;

  // Type
  IsNonZero isConditional;
  NotGadget needsSignature;

  // Compress the public key
  CompressPublicKey compressPublicKey;

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
  // Increase the number of conditional transactions (if conditional)
  UnsafeAddGadget numConditionalTransactionsAfter;

  AccountUpdateCircuit(ProtoboardT &pb, const TransactionState &state, const std::string &prefix)
      : BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        owner(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
        nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
        publicKeyX(make_variable(pb, FMT(prefix, ".publicKeyX"))),
        publicKeyY(make_variable(pb, FMT(prefix, ".publicKeyY"))),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),

        // Signature
        hash(
          pb,
          var_array(
            {state.exchange,
             accountID.packed,
             feeTokenID.packed,
             fee.packed,
             publicKeyX,
             publicKeyY,
             validUntil.packed,
             nonce.packed}),
          FMT(this->annotation_prefix, ".hash")),

        // Validate
        requireValidUntil(
          pb,
          state.timestamp,
          validUntil.packed,
          NUM_BITS_TIMESTAMP,
          FMT(prefix, ".requireValidUntil")),

        // Type
        isConditional(pb, type.packed, ".isConditional"),
        needsSignature(pb, isConditional.result(), ".needsSignature"),

        // Compress the public key
        compressPublicKey(
          pb,
          state.params,
          state.constants,
          publicKeyX,
          publicKeyY,
          FMT(this->annotation_prefix, ".compressPublicKey")),

        // Balances
        balanceS_A(pb, state.constants, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
        balanceB_O(pb, state.constants, state.oper.balanceB, FMT(prefix, ".balanceB_O")),
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
        feePayment(pb, balanceS_A, balanceB_O, fFee.value(), FMT(prefix, ".feePayment")),

        // Increase the nonce
        nonce_after(
          pb,
          state.accountA.account.nonce,
          state.constants._1,
          NUM_BITS_NONCE,
          FMT(prefix, ".nonce_after")),
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter(
          pb,
          state.numConditionalTransactions,
          isConditional.result(),
          FMT(prefix, ".numConditionalTransactionsAfter"))
  {
    // Update the account data
    setArrayOutput(accountA_Address, accountID.bits);
    setOutput(accountA_PublicKeyX, publicKeyX);
    setOutput(accountA_PublicKeyY, publicKeyY);
    setOutput(accountA_Nonce, nonce_after.result());

    // Update the account balance for the fee payment
    setArrayOutput(balanceA_S_Address, feeTokenID.bits);
    setOutput(balanceA_S_Balance, balanceS_A.balance());
    // Update the operator balance for the fee payment
    setOutput(balanceO_B_Balance, balanceB_O.balance());

    // We need a single signature of the account that's being updated if not
    // conditional
    setOutput(hash_A, hash.result());
    setOutput(signatureRequired_A, needsSignature.result());
    setOutput(signatureRequired_B, state.constants._0);

    // Increase the number of conditional transactions (if conditional)
    setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
  }

  void generate_r1cs_witness(const AccountUpdateTx &update)
  {
    // Inputs
    owner.generate_r1cs_witness();
    accountID.generate_r1cs_witness(pb, update.accountID);
    validUntil.generate_r1cs_witness(pb, update.validUntil);
    nonce.generate_r1cs_witness();
    pb.val(publicKeyX) = update.publicKeyX;
    pb.val(publicKeyY) = update.publicKeyY;
    feeTokenID.generate_r1cs_witness(pb, update.feeTokenID);
    fee.generate_r1cs_witness(pb, update.fee);
    type.generate_r1cs_witness(pb, update.type);

    // Signature
    hash.generate_r1cs_witness();

    // Validate
    requireValidUntil.generate_r1cs_witness();

    // Type
    isConditional.generate_r1cs_witness();
    needsSignature.generate_r1cs_witness();

    // Compress the public key
    compressPublicKey.generate_r1cs_witness();

    // Balances
    balanceS_A.generate_r1cs_witness();
    balanceB_O.generate_r1cs_witness();
    // Fee as float
    fFee.generate_r1cs_witness(toFloat(update.fee, Float16Encoding));
    requireAccuracyFee.generate_r1cs_witness();
    // Fee payment from to the operator
    feePayment.generate_r1cs_witness();

    // Increase the nonce
    nonce_after.generate_r1cs_witness();
    // Increase the number of conditional transactions (if conditional)
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
    type.generate_r1cs_constraints(true);

    // Signature
    hash.generate_r1cs_constraints();

    // Validate
    requireValidUntil.generate_r1cs_constraints();

    // Type
    isConditional.generate_r1cs_constraints();
    needsSignature.generate_r1cs_constraints();

    // Compress the public key
    compressPublicKey.generate_r1cs_constraints();

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
    // Increase the number of conditional transactions (if conditional)
    numConditionalTransactionsAfter.generate_r1cs_constraints();
  }

  const VariableArrayT getPublicData() const
  {
    return flattenReverse(
      {type.bits,
       owner.bits,
       accountID.bits,
       VariableArrayT(4, state.constants._0),
       feeTokenID.bits,
       fFee.bits(),
       compressPublicKey.result(),
       validUntil.bits,
       nonce.bits});
  }
};

} // namespace Loopring

#endif
