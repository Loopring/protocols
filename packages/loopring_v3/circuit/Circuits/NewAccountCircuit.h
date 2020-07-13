#ifndef _NEWACCOUNTCIRCUIT_H_
#define _NEWACCOUNTCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class NewAccountCircuit : public BaseTransactionCircuit
{
public:

    // Inputs
    DualVariableGadget payerAccountID;
    DualVariableGadget feeTokenID;
    DualVariableGadget fee;
    DualVariableGadget nonce;
    DualVariableGadget newAccountID;
    DualVariableGadget newOwner;
    VariableT newPublicKeyX;
    VariableT newPublicKeyY;
    DualVariableGadget walletHash;

    // Signature
    Poseidon_gadget_T<11, 1, 6, 53, 10, 1> hash;

    // Validate
    EqualGadget isNewAccountTx;
    RequireNotZeroGadget requireNewOwnerNotZero;
    IfThenRequireEqualGadget requireAccountLeafEmpty;

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

    NewAccountCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix),

        // Inputs
        payerAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".payerAccountID")),
        feeTokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".feeTokenID")),
        fee(pb, NUM_BITS_AMOUNT, FMT(prefix, ".fee")),
        nonce(pb, state.accountA.account.nonce, NUM_BITS_NONCE, FMT(prefix, ".nonce")),
        newAccountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".newAccountID")),
        newOwner(pb, NUM_BITS_ADDRESS, FMT(prefix, ".newOwner")),
        newPublicKeyX(make_variable(pb, FMT(prefix, ".newPublicKeyX"))),
        newPublicKeyY(make_variable(pb, FMT(prefix, ".newPublicKeyY"))),
        walletHash(pb, NUM_BITS_HASH, FMT(prefix, ".walletHash")),

        // Signature
        hash(pb, var_array({
            state.exchange,
            payerAccountID.packed,
            feeTokenID.packed,
            fee.packed,
            nonce.packed,
            newAccountID.packed,
            newOwner.packed,
            newPublicKeyX,
            newPublicKeyY,
            walletHash.packed
        }), FMT(this->annotation_prefix, ".hash")),

        // Validate
        isNewAccountTx(pb, state.type, state.constants.txTypeNewAccount, FMT(prefix, ".isNewAccountTx")),
        requireNewOwnerNotZero(pb, newOwner.packed, FMT(prefix, ".requireNewOwnerNotZero")),
        requireAccountLeafEmpty(pb, isNewAccountTx.result(), state.accountB.account.owner, state.constants.zero, FMT(prefix, ".requireAccountLeafEmpty")),

        // Compress the public key
        compressPublicKey(pb, state.params, state.constants, newPublicKeyX, newPublicKeyY, FMT(this->annotation_prefix, ".compressPublicKey")),

        // Balances
        balanceS_A(pb, state.constants, state.accountA.balanceS, state.index.balanceB, FMT(prefix, ".balanceS_A")),
        balanceB_O(pb, state.constants, state.oper.balanceB, state.index.balanceB, FMT(prefix, ".balanceB_O")),
        // Fee as float
        fFee(pb, state.constants, Float16Encoding, FMT(prefix, ".fFee")),
        requireAccuracyFee(pb, fFee.value(), fee.packed, Float16Accuracy, NUM_BITS_AMOUNT, FMT(prefix, ".requireAccuracyFee")),
        // Fee payment from to the operator
        feePayment(pb, balanceS_A, balanceB_O, fFee.value(), FMT(prefix, ".feePayment")),

        // Increase the nonce
        nonce_after(pb, state.accountA.account.nonce, state.constants.one, NUM_BITS_NONCE, FMT(prefix, ".nonce_after"))
    {
        setArrayOutput(accountA_Address, payerAccountID.bits);
        setOutput(accountA_Nonce, nonce_after.result());

        setArrayOutput(accountB_Address, newAccountID.bits);
        setOutput(accountB_Owner, newOwner.packed);
        setOutput(accountB_PublicKeyX, newPublicKeyX);
        setOutput(accountB_PublicKeyY, newPublicKeyY);
        setOutput(accountB_WalletHash, walletHash.packed);

        setArrayOutput(balanceA_S_Address, feeTokenID.bits);
        setOutput(balanceA_S_Balance, balanceS_A.balance());
        setOutput(balanceA_S_Index, balanceS_A.index());

        setOutput(balanceO_B_Balance, balanceB_O.balance());
        setOutput(balanceO_B_Index, balanceB_O.index());

        setOutput(hash_A, hash.result());
        setOutput(signatureRequired_A, state.constants.one);
        setOutput(signatureRequired_B, state.constants.zero);
    }

    void generate_r1cs_witness(const NewAccount& create)
    {
        // Inputs
        payerAccountID.generate_r1cs_witness(pb, create.payerAccountID);
        feeTokenID.generate_r1cs_witness(pb, create.feeTokenID);
        fee.generate_r1cs_witness(pb, create.fee);
        nonce.generate_r1cs_witness();
        newAccountID.generate_r1cs_witness(pb, create.newAccountID);
        newOwner.generate_r1cs_witness(pb, create.newOwner);
        pb.val(newPublicKeyX) = create.newPublicKeyX;
        pb.val(newPublicKeyY) = create.newPublicKeyY;
        walletHash.generate_r1cs_witness(pb, create.newWalletHash);

        // Signature
        hash.generate_r1cs_witness();

        // Validate
        isNewAccountTx.generate_r1cs_witness();
        requireNewOwnerNotZero.generate_r1cs_witness();
        requireAccountLeafEmpty.generate_r1cs_witness();

        // Compress the public key
        compressPublicKey.generate_r1cs_witness();

        // Balances
        balanceS_A.generate_r1cs_witness();
        balanceB_O.generate_r1cs_witness();
        // Fee as float
        fFee.generate_r1cs_witness(toFloat(create.fee, Float16Encoding));
        requireAccuracyFee.generate_r1cs_witness();
        // Fee payment from to the operator
        feePayment.generate_r1cs_witness();

        // Increase the nonce
        nonce_after.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        payerAccountID.generate_r1cs_constraints();
        feeTokenID.generate_r1cs_constraints();
        fee.generate_r1cs_constraints();
        nonce.generate_r1cs_constraints();
        newAccountID.generate_r1cs_constraints();
        newOwner.generate_r1cs_constraints();
        walletHash.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();

        // Validate
        isNewAccountTx.generate_r1cs_constraints();
        requireNewOwnerNotZero.generate_r1cs_constraints();
        requireAccountLeafEmpty.generate_r1cs_constraints();

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
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({
            payerAccountID.bits,
            VariableArrayT(4, state.constants.zero), feeTokenID.bits,
            fFee.bits(),
            newAccountID.bits,
            newOwner.bits,
            compressPublicKey.result(),
            walletHash.bits
        });
    }
};

}

#endif
