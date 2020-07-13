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
    DualVariableGadget nonce;
    VariableT publicKeyX;
    VariableT publicKeyY;
    DualVariableGadget walletHash;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget type;

    // Signature
    Poseidon_gadget_T<9, 1, 6, 53, 8, 1> hash;

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

    AccountUpdateCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        owner(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
        publicKeyX(make_variable(pb, FMT(prefix, ".publicKeyX"))),
        publicKeyY(make_variable(pb, FMT(prefix, ".publicKeyY"))),
        walletHash(pb, NUM_BITS_HASH, FMT(prefix, ".walletHash")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),

        // Signature
        hash(pb, var_array({
            state.exchange,
            accountID.packed,
            feeTokenID.packed,
            fee.packed,
            publicKeyX,
            publicKeyY,
            walletHash.packed,
            nonce.packed
        }), FMT(this->annotation_prefix, ".hash")),

        // Type
        isConditional(pb, type.packed, ".isConditional"),
        needsSignature(pb, isConditional.result(), ".needsSignature"),

        // Compress the public key
        compressPublicKey(pb, state.params, state.constants, publicKeyX, publicKeyY, FMT(this->annotation_prefix, ".compressPublicKey")),

        // Balances
        balanceS_A(pb, state.constants, state.accountA.balanceS, state.index.balanceB, FMT(prefix, ".balanceS_A")),
        balanceB_O(pb, state.constants, state.oper.balanceB, state.index.balanceB, FMT(prefix, ".balanceB_O")),
        // Fee as float
        fFee(pb, state.constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),
        // Fee payment from to the operator
        feePayment(pb, balanceS_A, balanceB_O, fFee.value(), FMT(prefix, ".feePayment")),

        // Increase the nonce
        nonce_after(pb, state.accountA.account.nonce, state.constants.one, NUM_BITS_NONCE, FMT(prefix, ".nonce_after")),
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter(pb, state.numConditionalTransactions, isConditional.result(), FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(accountA_Address, accountID.bits);
        setOutput(accountA_PublicKeyX, publicKeyX);
        setOutput(accountA_PublicKeyY, publicKeyY);
        setOutput(accountA_WalletHash, walletHash.packed);
        setOutput(accountA_Nonce, nonce_after.result());

        setArrayOutput(balanceA_S_Address, feeTokenID.bits);
        setOutput(balanceA_S_Balance, balanceS_A.balance());
        setOutput(balanceA_S_Index, balanceS_A.index());

        setOutput(balanceO_B_Balance, balanceB_O.balance());
        setOutput(balanceO_B_Index, balanceB_O.index());

        setOutput(hash_A, hash.result());
        setOutput(signatureRequired_A, needsSignature.result());
        setOutput(signatureRequired_B, state.constants.zero);

        setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const AccountUpdateTx& update)
    {
        // Inputs
        owner.generate_r1cs_witness();
        accountID.generate_r1cs_witness(pb, update.accountID);
        nonce.generate_r1cs_witness();
        pb.val(publicKeyX) = update.publicKeyX;
        pb.val(publicKeyY) = update.publicKeyY;
        walletHash.generate_r1cs_witness(pb, update.walletHash);
        feeTokenID.generate_r1cs_witness(pb, update.feeTokenID);
        fee.generate_r1cs_witness(pb, update.fee);
        type.generate_r1cs_witness(pb, update.type);

        // Signature
        hash.generate_r1cs_witness();

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
        nonce.generate_r1cs_constraints();
        walletHash.generate_r1cs_constraints();
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        type.generate_r1cs_constraints(true);

        // Signature
        hash.generate_r1cs_constraints();

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
        return flattenReverse({
            type.bits,
            owner.bits,
            accountID.bits,
            nonce.bits,
            compressPublicKey.result(),
            walletHash.bits,
            VariableArrayT(4, state.constants.zero), feeTokenID.bits,
            fFee.bits(),
        });
    }
};

}

#endif
