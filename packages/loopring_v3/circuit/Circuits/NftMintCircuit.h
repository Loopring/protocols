// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _NFTMINTCIRCUIT_H_
#define _NFTMINTCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

// Mints NFTs on L2.
class NftMintCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget minterAccountID;
    DualVariableGadget tokenAccountID;
    DualVariableGadget nftType;
    DualVariableGadget tokenAddress;
    DualVariableGadget nftIDLo;
    DualVariableGadget nftIDHi;
    DualVariableGadget creatorFeeBips;
    DualVariableGadget amount;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget validUntil;
    DualVariableGadget maxFee;
    DualVariableGadget toAccountID;
    DualVariableGadget toTokenID;
    DualVariableGadget to;
    DualVariableGadget storageID;
    DualVariableGadget type;

    // NftData
    NftDataGadget nftData;

    // Signature
    Poseidon_9 hash;

    // Type
    IsNonZero isConditional;
    NotEqualGadget isNotDeposit;
    NotGadget needsSignature;
    ArrayTernaryGadget onchainData;

    // Validate
    EqualGadget isNftMintTx;
    NotGadget isNotConditional;
    AndGadget isNftMintTxAndNotConditional;
    AndGadget isNftMintTxAndConditional;
    AndGadget isNftMintTxAndNotDeposit;
    OwnerValidGadget nftDataValid;
    RequireLtGadget requireValidUntil;
    RequireLeqGadget requireValidFee;
    RequireNotNftGadget requireFeeTokenNotNFT;
    OwnerValidGadget toOwnerValid;
    IfThenRequireEqualGadget requireToSelf;
    IfThenRequireNotEqualGadget requireMinterNotToken;
    IfThenRequireNotEqualGadget requireNonZeroAmount;
    IfThenRequireEqualGadget require_tokenAccountOwner_eq_tokenAddress;

    // Type differences
    ArrayTernaryGadget accountB_address;
    TernaryGadget accountB_owner;
    TernaryGadget amountBA;
    TernaryGadget weightBA;
    TernaryGadget amountSB;
    TernaryGadget weightSB;

    // Calculate the new NFT balance
    DynamicBalanceGadget balanceB_A;
    DynamicBalanceGadget balanceS_B;
    AddGadget balanceBA_after;
    AddGadget balanceSB_after;

    // Fee balances
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget balanceB_O;
    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;
    // Fee payment from From to the operator
    TransferGadget feePayment;

    // Nonce
    NonceGadget nonce;
    TernaryGadget storageData_after;
    TernaryGadget storageID_after;
    // Increase the number of conditional transactions
    UnsafeAddGadget numConditionalTransactionsAfter;

    NftMintCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          minterAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".minterAccountID")),
          tokenAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".tokenAccountID")),
          nftType(pb, NUM_BITS_TYPE, FMT(prefix, ".nftType")),
          tokenAddress(pb, NUM_BITS_ADDRESS, FMT(prefix, ".tokenAddress")),
          nftIDLo(pb, NUM_BITS_NFT_ID / 2, FMT(prefix, ".nftIDLo")),
          nftIDHi(pb, NUM_BITS_NFT_ID / 2, FMT(prefix, ".nftIDHi")),
          creatorFeeBips(pb, NUM_BITS_TYPE, FMT(prefix, ".creatorFeeBips")),
          amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
          feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
          fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
          validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
          maxFee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".maxFee")),
          toAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".toAccountID")),
          toTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".toTokenID")),
          to(pb, NUM_BITS_ADDRESS, FMT(prefix, ".to")),
          storageID(pb, NUM_BITS_STORAGEID, FMT(prefix, ".storageID")),
          type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),

          // NftData
          nftData(
            pb,
            state.accountA.account.owner,
            nftType.packed,
            tokenAddress.packed,
            nftIDLo.packed,
            nftIDHi.packed,
            creatorFeeBips.packed,
            FMT(this->annotation_prefix, ".NftData")),

          // Signature
          hash(
            pb,
            var_array(
              {state.exchange,
               minterAccountID.packed,
               toAccountID.packed,
               nftData.result(),
               amount.packed,
               feeTokenID.packed,
               maxFee.packed,
               validUntil.packed,
               storageID.packed}),
            FMT(this->annotation_prefix, ".hash")),

          // Type
          isConditional(pb, type.packed, FMT(prefix, ".isConditional")),
          isNotDeposit(pb, type.packed, state.constants._2, FMT(prefix, ".isNotDeposit")),
          needsSignature(pb, isConditional.result(), FMT(prefix, ".needsSignature")),
          onchainData(
            pb,
            isConditional.result(),
            flatten({VariableArrayT((16) * 8, state.constants._0), to.bits, toAccountID.bits}),
            flatten(
              {VariableArrayT((2) * 8, state.constants._0),
               creatorFeeBips.bits,
               nftIDLo.bits,
               nftIDHi.bits,
               tokenAccountID.bits,
               nftType.bits}),
            FMT(prefix, ".onchainData")),

          // Validate
          isNftMintTx( //
            pb,
            state.type,
            state.constants.txTypeNftMint,
            FMT(prefix, ".isNftMintTx")),
          isNotConditional(pb, isConditional.result(), FMT(prefix, ".isNotConditional")),
          isNftMintTxAndNotConditional(
            pb,
            {isNftMintTx.result(), isNotConditional.result()},
            FMT(prefix, ".isNftMintTxAndConditional")),
          isNftMintTxAndConditional(
            pb,
            {isNftMintTx.result(), isConditional.result()},
            FMT(prefix, ".isNftMintTxAndConditional")),
          isNftMintTxAndNotDeposit(
            pb,
            {isNftMintTx.result(), isNotDeposit.result()},
            FMT(prefix, ".isNftMintTxAndNotDeposit")),
          nftDataValid(
            pb,
            state.constants,
            state.accountB.balanceB.weightAMM,
            nftData.result(),
            isNftMintTx.result(),
            FMT(prefix, ".nftDataValid")),
          requireValidUntil(
            pb,
            state.timestamp,
            validUntil.packed,
            NUM_BITS_TIMESTAMP,
            FMT(prefix, ".requireValidUntil")),
          requireValidFee(pb, fee.packed, maxFee.packed, NUM_BITS_AMOUNT, FMT(prefix, ".requireValidFee")),
          requireFeeTokenNotNFT(pb, state.constants, feeTokenID.packed, FMT(prefix, ".requireFeeTokenNotNFT")),
          toOwnerValid(
            pb,
            state.constants,
            state.accountB.account.owner,
            to.packed,
            isNftMintTxAndConditional.result(),
            FMT(prefix, ".toOwnerValid")),
          requireToSelf(
            pb,
            isNftMintTxAndNotConditional.result(),
            minterAccountID.packed,
            toAccountID.packed,
            FMT(prefix, ".requireToSelf")),
          requireMinterNotToken(
            pb,
            isNftMintTxAndNotConditional.result(),
            state.accountA.account.owner,
            tokenAddress.packed,
            FMT(prefix, ".requireMinterNotToken")),
          requireNonZeroAmount(
            pb,
            isNftMintTx.result(),
            amount.packed,
            state.constants._0,
            FMT(prefix, ".requireNonZeroAmount")),
          require_tokenAccountOwner_eq_tokenAddress(
            pb,
            isNftMintTxAndNotConditional.result(),
            tokenAddress.packed,
            state.accountB.account.owner,
            FMT(prefix, ".require_tokenAccountOwner_eq_tokenAddress")),

          // Type differences
          accountB_address(
            pb,
            isConditional.result(),
            toAccountID.bits,
            tokenAccountID.bits,
            FMT(prefix, ".accountB_address")),
          accountB_owner(
            pb,
            isConditional.result(),
            to.packed,
            state.accountB.account.owner,
            FMT(prefix, ".accountB_owner")),
          amountBA(pb, isConditional.result(), state.constants._0, amount.packed, FMT(prefix, ".amountBA")),
          weightBA(
            pb,
            isConditional.result(),
            state.accountA.balanceB.weightAMM,
            nftData.result(),
            FMT(prefix, ".weightBA")),
          amountSB(pb, isConditional.result(), amount.packed, state.constants._0, FMT(prefix, ".amountSB")),
          weightSB(
            pb,
            isConditional.result(),
            nftData.result(),
            state.accountB.balanceS.weightAMM,
            FMT(prefix, ".weightSB")),

          // Calculate the new balance
          balanceB_A(pb, state.accountA.balanceB, FMT(prefix, ".balanceB_A")),
          balanceS_B(pb, state.accountB.balanceS, FMT(prefix, ".balanceS_B")),
          balanceBA_after(
            pb,
            balanceB_A.balance(),
            amountBA.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".balanceBA_after")),
          balanceSB_after(
            pb,
            balanceS_B.balance(),
            amountSB.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".balanceSB_after")),

          // Fee balances
          balanceS_A(pb, state.accountA.balanceS, FMT(prefix, ".balanceS_A")),
          balanceB_O(pb, state.oper.balanceB, FMT(prefix, ".balanceB_O")),
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

          // Nonce
          nonce(
            pb,
            state.constants,
            state.accountA.storage,
            storageID,
            isNftMintTxAndNotDeposit.result(),
            FMT(prefix, ".nonce")),
          storageData_after(
            pb,
            isNotDeposit.result(),
            nonce.getData(),
            state.accountA.storage.data,
            FMT(prefix, ".storageData_after")),
          storageID_after(
            pb,
            isNotDeposit.result(),
            storageID.packed,
            state.accountA.storage.storageID,
            FMT(prefix, ".storageID_after")),
          // Increase the number of conditional transactions
          numConditionalTransactionsAfter(
            pb,
            state.numConditionalTransactions,
            isConditional.result(),
            FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, minterAccountID.bits);

        // Update the account balances
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, feeTokenID.bits);
        setArrayOutput(TXV_BALANCE_A_B_ADDRESS, toTokenID.bits);
        setOutput(TXV_BALANCE_A_S_BALANCE, balanceS_A.balance());
        setOutput(TXV_BALANCE_A_B_WEIGHTAMM, weightBA.result());
        setOutput(TXV_BALANCE_A_B_BALANCE, balanceBA_after.result());

        setArrayOutput(TXV_BALANCE_B_B_ADDRESS, feeTokenID.bits);

        setArrayOutput(TXV_ACCOUNT_B_ADDRESS, accountB_address.result());
        setOutput(TXV_ACCOUNT_B_OWNER, accountB_owner.result());

        setArrayOutput(TXV_BALANCE_B_S_ADDRESS, toTokenID.bits);
        setOutput(TXV_BALANCE_B_S_BALANCE, balanceSB_after.result());
        setOutput(TXV_BALANCE_B_S_WEIGHTAMM, weightSB.result());

        // Update the operator balance for the fee payment
        setOutput(TXV_BALANCE_O_B_BALANCE, balanceB_O.balance());

        // We need a single signature of the account that's being updated if not
        // conditional
        setOutput(TXV_HASH_A, hash.result());
        setOutput(TXV_SIGNATURE_REQUIRED_A, needsSignature.result());
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);

        // Increase the number of conditional transactions (if conditional)
        setOutput(TXV_NUM_CONDITIONAL_TXS, numConditionalTransactionsAfter.result());

        // Nonce
        setArrayOutput(TXV_STORAGE_A_ADDRESS, subArray(storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS));
        setOutput(TXV_STORAGE_A_DATA, storageData_after.result());
        setOutput(TXV_STORAGE_A_STORAGEID, storageID_after.result());
    }

    void generate_r1cs_witness(const NftMint &nftMint)
    {
        // Inputs
        minterAccountID.generate_r1cs_witness(pb, nftMint.minterAccountID);
        tokenAccountID.generate_r1cs_witness(pb, nftMint.tokenAccountID);
        nftType.generate_r1cs_witness(pb, nftMint.nftType);
        tokenAddress.generate_r1cs_witness(pb, nftMint.tokenAddress);
        nftIDLo.generate_r1cs_witness(pb, nftMint.nftIDLo);
        nftIDHi.generate_r1cs_witness(pb, nftMint.nftIDHi);
        creatorFeeBips.generate_r1cs_witness(pb, nftMint.creatorFeeBips);
        amount.generate_r1cs_witness(pb, nftMint.amount);
        feeTokenID.generate_r1cs_witness(pb, nftMint.feeTokenID);
        fee.generate_r1cs_witness(pb, nftMint.fee);
        validUntil.generate_r1cs_witness(pb, nftMint.validUntil);
        maxFee.generate_r1cs_witness(pb, nftMint.maxFee);
        toAccountID.generate_r1cs_witness(pb, nftMint.toAccountID);
        toTokenID.generate_r1cs_witness(pb, nftMint.toTokenID);
        to.generate_r1cs_witness(pb, nftMint.to);
        storageID.generate_r1cs_witness(pb, nftMint.storageID);
        type.generate_r1cs_witness(pb, nftMint.type);

        // NftData
        nftData.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();

        // Type
        isConditional.generate_r1cs_witness();
        isNotDeposit.generate_r1cs_witness();
        needsSignature.generate_r1cs_witness();
        onchainData.generate_r1cs_witness();

        // Validate
        isNftMintTx.generate_r1cs_witness();
        isNotConditional.generate_r1cs_witness();
        isNftMintTxAndNotConditional.generate_r1cs_witness();
        isNftMintTxAndConditional.generate_r1cs_witness();
        isNftMintTxAndNotDeposit.generate_r1cs_witness();
        nftDataValid.generate_r1cs_witness();
        requireValidUntil.generate_r1cs_witness();
        requireValidFee.generate_r1cs_witness();
        requireFeeTokenNotNFT.generate_r1cs_witness();
        toOwnerValid.generate_r1cs_witness();
        requireToSelf.generate_r1cs_witness();
        requireMinterNotToken.generate_r1cs_witness();
        requireNonZeroAmount.generate_r1cs_witness();
        require_tokenAccountOwner_eq_tokenAddress.generate_r1cs_witness();

        // Type differences
        accountB_address.generate_r1cs_witness();
        accountB_owner.generate_r1cs_witness();
        amountBA.generate_r1cs_witness();
        weightBA.generate_r1cs_witness();
        amountSB.generate_r1cs_witness();
        weightSB.generate_r1cs_witness();

        // Calculate the new NFT balance
        balanceB_A.generate_r1cs_witness();
        balanceS_B.generate_r1cs_witness();
        balanceBA_after.generate_r1cs_witness();
        balanceSB_after.generate_r1cs_witness();

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_O.generate_r1cs_witness();
        // Fee as float
        fFee.generate_r1cs_witness(toFloat(nftMint.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Fee payment from to the operator
        feePayment.generate_r1cs_witness();

        // Nonce
        nonce.generate_r1cs_witness();
        storageData_after.generate_r1cs_witness();
        storageID_after.generate_r1cs_witness();
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        minterAccountID.generate_r1cs_constraints(true);
        tokenAccountID.generate_r1cs_constraints(true);
        nftType.generate_r1cs_constraints(true);
        tokenAddress.generate_r1cs_constraints(true);
        nftIDLo.generate_r1cs_constraints(true);
        nftIDHi.generate_r1cs_constraints(true);
        creatorFeeBips.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        maxFee.generate_r1cs_constraints(true);
        toAccountID.generate_r1cs_constraints(true);
        toTokenID.generate_r1cs_constraints(true);
        to.generate_r1cs_constraints(true);
        storageID.generate_r1cs_constraints(true);
        type.generate_r1cs_constraints(true);

        // NftData
        nftData.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();

        // Type
        isConditional.generate_r1cs_constraints();
        isNotDeposit.generate_r1cs_constraints();
        needsSignature.generate_r1cs_constraints();
        onchainData.generate_r1cs_constraints();

        // Validate
        isNftMintTx.generate_r1cs_constraints();
        isNotConditional.generate_r1cs_constraints();
        isNftMintTxAndNotConditional.generate_r1cs_constraints();
        isNftMintTxAndConditional.generate_r1cs_constraints();
        isNftMintTxAndNotDeposit.generate_r1cs_constraints();
        nftDataValid.generate_r1cs_constraints();
        requireValidUntil.generate_r1cs_constraints();
        requireValidFee.generate_r1cs_constraints();
        requireFeeTokenNotNFT.generate_r1cs_constraints();
        toOwnerValid.generate_r1cs_constraints();
        requireToSelf.generate_r1cs_constraints();
        requireMinterNotToken.generate_r1cs_constraints();
        requireNonZeroAmount.generate_r1cs_constraints();
        require_tokenAccountOwner_eq_tokenAddress.generate_r1cs_constraints();

        // Type differences
        accountB_address.generate_r1cs_constraints();
        accountB_owner.generate_r1cs_constraints();
        amountBA.generate_r1cs_constraints();
        weightBA.generate_r1cs_constraints();
        amountSB.generate_r1cs_constraints();
        weightSB.generate_r1cs_constraints();

        // Calculate the new NFT balance
        balanceB_A.generate_r1cs_constraints();
        balanceS_B.generate_r1cs_constraints();
        balanceBA_after.generate_r1cs_constraints();
        balanceSB_after.generate_r1cs_constraints();

        // Balances
        balanceS_A.generate_r1cs_constraints();
        balanceB_O.generate_r1cs_constraints();
        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();
        // Fee payment from to the operator
        feePayment.generate_r1cs_constraints();

        // Nonce
        nonce.generate_r1cs_constraints();
        storageData_after.generate_r1cs_constraints();
        storageID_after.generate_r1cs_constraints();
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse(
          {type.bits,
           minterAccountID.bits,
           toTokenID.bits,
           feeTokenID.bits,
           fFee.bits(),
           amount.bits,
           storageID.bits,
           onchainData.result()});
    }
};

} // namespace Loopring

#endif