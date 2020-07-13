#ifndef _INTERNAL_TRANSFER_CIRCUIT_H_
#define _INTERNAL_TRANSFER_CIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "../Utils/Utils.h"


#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;
namespace Loopring
{

/*
    Default: to != 0 and toAccountID != 0
    New account: to != 0 and toAccountID == 0
    Open: to == 0 and toAccountID == 0
    Invalid: to == 0 and toAccountID != 0

    // Allow the payer to use dual authoring
    if (payer_to != 0) {
        require(payer_to == to);
        require(payer_toAccountID == payee_toAccountID);
    }
    // Allow sending to an address instead of a specific accountID.
    if (payee_toAccountID != 0) {
        require(payee_toAccountID == toAccountID);
    }
    require (to != 0);
    require (toAccountID > 1);
*/
class TransferCircuit : public BaseTransactionCircuit
{
public:

    // Inputs
    DualVariableGadget fromAccountID;
    DualVariableGadget toAccountID;
    DualVariableGadget tokenID;
    DualVariableGadget amount;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget validUntil;
    DualVariableGadget type;
    DualVariableGadget from;
    DualVariableGadget to;
    DualVariableGadget nonce;
    VariableT dualAuthorX;
    VariableT dualAuthorY;
    DualVariableGadget data;
    DualVariableGadget payer_toAccountID;
    DualVariableGadget payer_to;
    DualVariableGadget payee_toAccountID;

    // Check if the inputs are valid
    EqualGadget isTransferTx;
    IsNonZero isNonZero_payer_to;
    IfThenRequireEqualGadget ifrequire_payer_to_eq_to;
    IfThenRequireEqualGadget ifrequire_payer_toAccountID_eq_payee_toAccountID;
    IsNonZero isNonZero_payee_toAccountID;
    IfThenRequireEqualGadget ifrequire_payee_toAccountID_eq_toAccountID;
    IfThenRequireNotEqualGadget ifrequire_NotZero_to;
    RequireLtGadget requireValidUntil;

    // Fill in standard dual author key if none is given
    IsNonZero isNonZero_dualAuthorX;
    IsNonZero isNonZero_dualAuthorY;
    OrGadget isNonZero_dualAuthor;
    TernaryGadget resolvedDualAuthorX;
    TernaryGadget resolvedDualAuthorY;

    // Signature
    Poseidon_gadget_T<14, 1, 6, 53, 13, 1> hashPayer;
    Poseidon_gadget_T<14, 1, 6, 53, 13, 1> hashDual;

    // Balances
    DynamicBalanceGadget balanceS_A;
    DynamicBalanceGadget balanceB_A;
    DynamicBalanceGadget balanceB_B;
    DynamicBalanceGadget balanceA_O;

    // Validation
    OwnerValidGadget toAccountValid;

    // Type
    IsNonZero isConditional;
    NotGadget needsSignature;

    // DA optimization
    OrGadget da_NeedsToAddress;
    ArrayTernaryGadget da_To;
    ArrayTernaryGadget da_From;
    ArrayTernaryGadget da_Nonce;

    // Fee as float
    FloatGadget fFee;
    RequireAccuracyGadget requireAccuracyFee;
    // Amount as float
    FloatGadget fAmount;
    RequireAccuracyGadget requireAccuracyAmount;

    // Fee payment from From to the operator
    TransferGadget feePayment;
    // Transfer from From to To
    TransferGadget transferPayment;

    // Increase the nonce of From by 1
    AddGadget nonce_From_after;
    // Increase the number of conditional transactions (if conditional)
    UnsafeAddGadget numConditionalTransactionsAfter;

    TransferCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        fromAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".fromAccountID")),
        toAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".toAccountID")),
        tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
        amount(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amount")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
        type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),
        from(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".from")),
        to(pb, NUM_BITS_ADDRESS, FMT(prefix, ".to")),
        nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
        dualAuthorX(make_variable(pb, FMT(prefix, ".dualAuthorX"))),
        dualAuthorY(make_variable(pb, FMT(prefix, ".dualAuthorY"))),
        data(pb, NUM_BITS_FIELD_CAPACITY, FMT(prefix, ".data")),
        payer_toAccountID(pb, NUM_BITS_ADDRESS, FMT(prefix, ".payer_toAccountID")),
        payer_to(pb, NUM_BITS_ADDRESS, FMT(prefix, ".payer_to")),
        payee_toAccountID(pb, NUM_BITS_ADDRESS, FMT(prefix, ".payee_toAccountID")),

        // Check if the inputs are valid
        isTransferTx(pb, state.type, state.constants.txTypeTransfer, FMT(prefix, ".isTransferTx")),
        isNonZero_payer_to(pb, payer_to.packed, FMT(prefix, ".isNonZero_payer_to")),
        ifrequire_payer_to_eq_to(pb, isNonZero_payer_to.result(), payer_to.packed, to.packed, FMT(prefix, ".ifrequire_payer_to_eq_to")),
        ifrequire_payer_toAccountID_eq_payee_toAccountID(pb, isNonZero_payer_to.result(), payer_toAccountID.packed, toAccountID.packed, FMT(prefix, ".ifrequire_payer_toAccountID_eq_payee_toAccountID")),
        isNonZero_payee_toAccountID(pb, payee_toAccountID.packed, FMT(prefix, ".isNonZero_payee_toAccountID")),
        ifrequire_payee_toAccountID_eq_toAccountID(pb, isNonZero_payee_toAccountID.result(), payee_toAccountID.packed, toAccountID.packed, FMT(prefix, ".ifrequire_payee_toAccountID_eq_toAccountID")),
        ifrequire_NotZero_to(pb, isTransferTx.result(), to.packed, state.constants.zero, FMT(prefix, ".ifrequire_NotZero_to")),
        requireValidUntil(pb, state.timestamp, validUntil.packed, NUM_BITS_TIMESTAMP, FMT(prefix, ".requireValidUntil")),

        // Fill in standard dual author key if none is given
        isNonZero_dualAuthorX(pb, dualAuthorX, FMT(prefix, ".isNonZero_dualAuthorX")),
        isNonZero_dualAuthorY(pb, dualAuthorY, FMT(prefix, ".isNonZero_dualAuthorY")),
        isNonZero_dualAuthor(pb, {isNonZero_dualAuthorX.result(), isNonZero_dualAuthorY.result()}, FMT(prefix, ".isNonZero_dualAuthor")),
        resolvedDualAuthorX(pb, isNonZero_dualAuthor.result(), dualAuthorX, state.accountA.account.publicKey.x, FMT(prefix, ".resolvedDualAuthorX")),
        resolvedDualAuthorY(pb, isNonZero_dualAuthor.result(), dualAuthorY, state.accountA.account.publicKey.y, FMT(prefix, ".resolvedDualAuthorY")),

        // Signature
        hashPayer(pb, var_array({
            state.exchange,
            fromAccountID.packed,
            payer_toAccountID.packed,
            tokenID.packed,
            amount.packed,
            feeTokenID.packed,
            fee.packed,
            validUntil.packed,
            payer_to.packed,
            dualAuthorX,
            dualAuthorY,
            data.packed,
            nonce.packed
        }), FMT(this->annotation_prefix, ".hashPayer")),
        hashDual(pb, var_array({
            state.exchange,
            fromAccountID.packed,
            payee_toAccountID.packed,
            tokenID.packed,
            amount.packed,
            feeTokenID.packed,
            fee.packed,
            validUntil.packed,
            to.packed,
            dualAuthorX,
            dualAuthorY,
            data.packed,
            nonce.packed
        }), FMT(this->annotation_prefix, ".hashDual")),

        // Balances
        balanceS_A(pb, state.constants, state.accountA.balanceS, state.index.balanceB, FMT(prefix, ".balanceS_A")),
        balanceB_A(pb, state.constants, state.accountA.balanceB, state.index.balanceA, FMT(prefix, ".balanceB_A")),
        balanceB_B(pb, state.constants, state.accountB.balanceB, state.index.balanceB, FMT(prefix, ".balanceB_B")),
        balanceA_O(pb, state.constants, state.oper.balanceA, state.index.balanceA, FMT(prefix, ".balanceA_O")),

        // Validation
        toAccountValid(pb, state.constants, state.accountB.account.owner, to.packed, FMT(prefix, ".ownerValid")),

        // Type
        isConditional(pb, type.packed, ".isConditional"),
        needsSignature(pb, isConditional.result(), ".needsSignature"),

        // DA optimization
        da_NeedsToAddress(pb, {toAccountValid.isNewAccount(), isConditional.result()}, FMT(prefix, ".da_NeedsToAddress")),
        da_To(pb, da_NeedsToAddress.result(), to.bits, VariableArrayT(NUM_BITS_ADDRESS, state.constants.zero), FMT(prefix, ".da_To")),
        da_From(pb, isConditional.result(), from.bits, VariableArrayT(NUM_BITS_ADDRESS, state.constants.zero), FMT(prefix, ".da_From")),
        da_Nonce(pb, isConditional.result(), nonce.bits, VariableArrayT(NUM_BITS_NONCE, state.constants.zero), FMT(prefix, ".da_Nonce")),

        // Fee as float
        fFee(pb, state.constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),
        // Amount as float
        fAmount(pb, state.constants, Float24Encoding, FMT(prefix, ".fAmount")),
        requireAccuracyAmount(pb, fAmount.value(), amount.packed, Float24Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyAmount")),
        // Fee payment from From to the operator
        feePayment(pb, balanceB_A, balanceA_O, fFee.value(), FMT(prefix, ".feePayment")),
        // Transfer from From to To
        transferPayment(pb, balanceS_A, balanceB_B, fAmount.value(), FMT(prefix, ".transferPayment")),

        // Increase the nonce of From by 1
        nonce_From_after(pb, state.accountA.account.nonce, state.constants.one, NUM_BITS_NONCE, FMT(prefix, ".nonce_From_after")),
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter(pb, state.numConditionalTransactions, isConditional.result(), FMT(prefix, ".numConditionalTransactionsAfter"))
    {
        setArrayOutput(accountA_Address, fromAccountID.bits);
        setOutput(accountA_Nonce, nonce_From_after.result());

        setArrayOutput(balanceA_S_Address, tokenID.bits);
        setOutput(balanceA_S_Balance, balanceS_A.balance());
        setOutput(balanceA_S_Index, balanceS_A.index());
        setArrayOutput(balanceB_S_Address, feeTokenID.bits);
        setOutput(balanceA_B_Balance, balanceB_A.balance());
        setOutput(balanceA_B_Index, balanceB_A.index());

        setArrayOutput(accountB_Address, toAccountID.bits);
        setOutput(accountB_Owner, to.packed);

        setArrayOutput(balanceA_S_Address, tokenID.bits);
        setOutput(balanceB_B_Balance, balanceB_B.balance());
        setOutput(balanceB_B_Index, balanceB_B.index());

        setOutput(balanceO_A_Balance, balanceA_O.balance());
        setOutput(balanceO_A_Index, balanceA_O.index());

        setOutput(hash_A, hashPayer.result());

        setOutput(hash_B, hashDual.result());
        setOutput(publicKeyX_B, resolvedDualAuthorX.result());
        setOutput(publicKeyY_B, resolvedDualAuthorY.result());

        setOutput(signatureRequired_A, needsSignature.result());
        setOutput(signatureRequired_B, needsSignature.result());

        setOutput(misc_NumConditionalTransactions, numConditionalTransactionsAfter.result());
    }

    void generate_r1cs_witness(const Transfer& transfer)
    {
        // Inputs
        fromAccountID.generate_r1cs_witness(pb, transfer.fromAccountID);
        toAccountID.generate_r1cs_witness(pb, transfer.toAccountID);
        tokenID.generate_r1cs_witness(pb, transfer.tokenID);
        amount.generate_r1cs_witness(pb, transfer.amount);
        feeTokenID.generate_r1cs_witness(pb, transfer.feeTokenID);
        fee.generate_r1cs_witness(pb, transfer.fee);
        validUntil.generate_r1cs_witness(pb, transfer.validUntil);
        type.generate_r1cs_witness(pb, transfer.type);
        from.generate_r1cs_witness();
        to.generate_r1cs_witness(pb, transfer.to);
        nonce.generate_r1cs_witness();
        pb.val(dualAuthorX) = transfer.dualAuthorX;
        pb.val(dualAuthorY) = transfer.dualAuthorY;
        data.generate_r1cs_witness(pb, transfer.data);
        payer_toAccountID.generate_r1cs_witness(pb, transfer.payerToAccountID);
        payer_to.generate_r1cs_witness(pb, transfer.payerTo);
        payee_toAccountID.generate_r1cs_witness(pb, transfer.payeeToAccountID);

        // Check if the inputs are valid
        isTransferTx.generate_r1cs_witness();
        isNonZero_payer_to.generate_r1cs_witness();
        ifrequire_payer_to_eq_to.generate_r1cs_witness();
        ifrequire_payer_toAccountID_eq_payee_toAccountID.generate_r1cs_witness();
        isNonZero_payee_toAccountID.generate_r1cs_witness();
        ifrequire_payee_toAccountID_eq_toAccountID.generate_r1cs_witness();
        ifrequire_NotZero_to.generate_r1cs_witness();
        requireValidUntil.generate_r1cs_witness();

        // Fill in standard dual author key if none is given
        isNonZero_dualAuthorX.generate_r1cs_witness();
        isNonZero_dualAuthorY.generate_r1cs_witness();
        isNonZero_dualAuthor.generate_r1cs_witness();
        resolvedDualAuthorX.generate_r1cs_witness();
        resolvedDualAuthorY.generate_r1cs_witness();

        // Signatures
        hashPayer.generate_r1cs_witness();
        hashDual.generate_r1cs_witness();

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_A.generate_r1cs_witness();
        balanceB_B.generate_r1cs_witness();
        balanceA_O.generate_r1cs_witness();

        // Validation
        toAccountValid.generate_r1cs_witness();

        // Type
        isConditional.generate_r1cs_witness();
        needsSignature.generate_r1cs_witness();

        // DA optimization
        da_NeedsToAddress.generate_r1cs_witness();
        da_To.generate_r1cs_witness();
        da_From.generate_r1cs_witness();
        da_Nonce.generate_r1cs_witness();

        // Fee as float
        fFee.generate_r1cs_witness(toFloat(transfer.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Amount as float
        fAmount.generate_r1cs_witness(toFloat(transfer.amount, Float24Encoding));
        requireAccuracyAmount.generate_r1cs_witness();
        // Fee payment from From to the operator
        feePayment.generate_r1cs_witness();
        // Transfer from From to To
        transferPayment.generate_r1cs_witness();

        // Increase the nonce of From by 1
        nonce_From_after.generate_r1cs_witness();
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        fromAccountID.generate_r1cs_constraints(true);
        toAccountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        amount.generate_r1cs_constraints(true);
        feeTokenID.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        type.generate_r1cs_constraints(true);
        from.generate_r1cs_constraints(true);
        to.generate_r1cs_constraints(true);
        nonce.generate_r1cs_constraints(true);
        data.generate_r1cs_constraints(true);

        // Check if the inputs are valid
        isTransferTx.generate_r1cs_constraints();
        isNonZero_payer_to.generate_r1cs_constraints();
        ifrequire_payer_to_eq_to.generate_r1cs_constraints();
        ifrequire_payer_toAccountID_eq_payee_toAccountID.generate_r1cs_constraints();
        isNonZero_payee_toAccountID.generate_r1cs_constraints();
        ifrequire_payee_toAccountID_eq_toAccountID.generate_r1cs_constraints();
        ifrequire_NotZero_to.generate_r1cs_constraints();
        requireValidUntil.generate_r1cs_constraints();

        // Fill in standard dual author key if none is given
        isNonZero_dualAuthorX.generate_r1cs_constraints();
        isNonZero_dualAuthorY.generate_r1cs_constraints();
        isNonZero_dualAuthor.generate_r1cs_constraints();
        resolvedDualAuthorX.generate_r1cs_constraints();
        resolvedDualAuthorY.generate_r1cs_constraints();

        // Signatures
        hashPayer.generate_r1cs_constraints();
        hashDual.generate_r1cs_constraints();

        // Balances
        balanceS_A.generate_r1cs_constraints();
        balanceB_A.generate_r1cs_constraints();
        balanceB_B.generate_r1cs_constraints();
        balanceA_O.generate_r1cs_constraints();

        // Validation
        toAccountValid.generate_r1cs_constraints();

        // Type
        isConditional.generate_r1cs_constraints();
        needsSignature.generate_r1cs_constraints();

        // DA optimization
        da_NeedsToAddress.generate_r1cs_constraints();
        da_To.generate_r1cs_constraints();
        da_From.generate_r1cs_constraints();
        da_Nonce.generate_r1cs_constraints();

        // Fee as float
        fFee.generate_r1cs_constraints();
        requireAccuracyFee.generate_r1cs_constraints();
        // Amount as float
        fAmount.generate_r1cs_constraints();
        requireAccuracyAmount.generate_r1cs_constraints();
        // Fee payment from From to the operator
        feePayment.generate_r1cs_constraints();
        // Transfer from From to To
        transferPayment.generate_r1cs_constraints();

        // Increase the nonce of From by 1
        nonce_From_after.generate_r1cs_constraints();
        // Increase the number of conditional transactions (if conditional)
        numConditionalTransactionsAfter.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({
            type.bits,
            fromAccountID.bits,
            toAccountID.bits,
            tokenID.bits,
            feeTokenID.bits,
            fAmount.bits(),
            fFee.bits(),
            da_To.result(),
            da_Nonce.result(),
            da_From.result(),
            VariableArrayT(256 - NUM_BITS_FIELD_CAPACITY, state.constants.zero), data.bits
        });
    }
};

} // namespace Loopring

#endif
