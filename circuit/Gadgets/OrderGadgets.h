#ifndef _ORDERGADGETS_H_
#define _ORDERGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class OrderGadget : public GadgetT
{
public:

    libsnark::dual_variable_gadget<FieldT> walletID;
    libsnark::dual_variable_gadget<FieldT> orderID;
    libsnark::dual_variable_gadget<FieldT> accountS;
    libsnark::dual_variable_gadget<FieldT> accountB;
    libsnark::dual_variable_gadget<FieldT> accountF;
    libsnark::dual_variable_gadget<FieldT> amountS;
    libsnark::dual_variable_gadget<FieldT> amountB;
    libsnark::dual_variable_gadget<FieldT> amountF;
    libsnark::dual_variable_gadget<FieldT> walletF;
    libsnark::dual_variable_gadget<FieldT> minerF;
    libsnark::dual_variable_gadget<FieldT> minerS;
    libsnark::dual_variable_gadget<FieldT> walletSplitPercentage;
    libsnark::dual_variable_gadget<FieldT> validSince;
    libsnark::dual_variable_gadget<FieldT> validUntil;
    libsnark::dual_variable_gadget<FieldT> allOrNone;
    libsnark::dual_variable_gadget<FieldT> padding;

    libsnark::dual_variable_gadget<FieldT> waiveFeePercentage;

    VariableT tokenS;
    VariableT tokenB;
    libsnark::dual_variable_gadget<FieldT> tokenF;

    const jubjub::VariablePointT publicKey;
    const jubjub::VariablePointT walletPublicKey;
    const jubjub::VariablePointT minerPublicKeyF;
    const jubjub::VariablePointT minerPublicKeyS;

    VariableT filledBefore;
    VariableT cancelled;

    VariableT balanceS;
    VariableT balanceB;
    VariableT balanceF;

    SignatureVerifier signatureVerifier;

    // Validity checking
    LeqGadget validSince_leq_timestamp;
    LeqGadget timestamp_leq_validUntil;

    VariableT valid;

    OrderGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& timestamp,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        walletID(pb, 16, FMT(prefix, ".walletID")),
        orderID(pb, 4, FMT(prefix, ".orderID")),
        accountS(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountS")),
        accountB(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountB")),
        accountF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountF")),
        amountS(pb, 96, FMT(prefix, ".amountS")),
        amountB(pb, 96, FMT(prefix, ".amountB")),
        amountF(pb, 96, FMT(prefix, ".amountF")),
        walletF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".walletF")),
        minerF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".minerF")),
        minerS(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".minerS")),
        validSince(pb, 32, FMT(prefix, ".validSince")),
        validUntil(pb, 32, FMT(prefix, ".validUntil")),
        allOrNone(pb, 1, FMT(prefix, ".allOrNone")),
        padding(pb, 1, FMT(prefix, ".padding")),

        walletSplitPercentage(pb, 8, FMT(prefix, ".walletSplitPercentage")),
        waiveFeePercentage(pb, 7, FMT(prefix, ".waiveFeePercentage")),

        tokenS(make_variable(pb, FMT(prefix, ".tokenS"))),
        tokenB(make_variable(pb, FMT(prefix, ".tokenB"))),
        tokenF(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenF")),

        publicKey(pb, FMT(prefix, ".publicKey")),
        walletPublicKey(pb, FMT(prefix, ".walletPublicKey")),
        minerPublicKeyF(pb, FMT(prefix, ".minerPublicKeyF")),
        minerPublicKeyS(pb, FMT(prefix, ".minerPublicKeyS")),

        filledBefore(make_variable(pb, FMT(prefix, ".filledBefore"))),
        cancelled(make_variable(pb, FMT(prefix, ".cancelled"))),

        balanceS(make_variable(pb, FMT(prefix, ".balanceS"))),
        balanceB(make_variable(pb, FMT(prefix, ".balanceB"))),
        balanceF(make_variable(pb, FMT(prefix, ".balanceF"))),

        signatureVerifier(pb, params, publicKey,
                          flatten({walletID.bits, orderID.bits, accountS.bits, accountB.bits, accountF.bits, amountS.bits, amountB.bits, amountF.bits}),
                          FMT(prefix, ".signatureVerifier")),

        validSince_leq_timestamp(pb, validSince.packed, timestamp, FMT(prefix, "validSince <= timestamp")),
        timestamp_leq_validUntil(pb, timestamp, validUntil.packed, FMT(prefix, "timestamp <= validUntil")),

        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableArrayT& getHash()
    {
        return signatureVerifier.getHash();
    }

    const VariableT& isValid() const
    {
        return valid;
    }

    void generate_r1cs_witness(const Order& order)
    {
        walletID.bits.fill_with_bits_of_field_element(pb, order.walletID);
        walletID.generate_r1cs_witness_from_bits();
        orderID.bits.fill_with_bits_of_field_element(pb, order.orderID);
        orderID.generate_r1cs_witness_from_bits();

        accountS.bits.fill_with_bits_of_field_element(pb, order.accountS);
        accountS.generate_r1cs_witness_from_bits();
        accountB.bits.fill_with_bits_of_field_element(pb, order.accountB);
        accountB.generate_r1cs_witness_from_bits();
        accountF.bits.fill_with_bits_of_field_element(pb, order.accountF);
        accountF.generate_r1cs_witness_from_bits();

        amountS.bits.fill_with_bits_of_field_element(pb, order.amountS);
        amountS.generate_r1cs_witness_from_bits();
        amountB.bits.fill_with_bits_of_field_element(pb, order.amountB);
        amountB.generate_r1cs_witness_from_bits();
        amountF.bits.fill_with_bits_of_field_element(pb, order.amountF);
        amountF.generate_r1cs_witness_from_bits();

        walletF.bits.fill_with_bits_of_field_element(pb, order.walletF);
        walletF.generate_r1cs_witness_from_bits();
        minerF.bits.fill_with_bits_of_field_element(pb, order.minerF);
        minerF.generate_r1cs_witness_from_bits();
        minerS.bits.fill_with_bits_of_field_element(pb, order.minerS);
        minerS.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        walletSplitPercentage.bits.fill_with_bits_of_field_element(pb, order.walletSplitPercentage);
        walletSplitPercentage.generate_r1cs_witness_from_bits();

        validSince.bits.fill_with_bits_of_field_element(pb, order.validSince);
        validSince.generate_r1cs_witness_from_bits();
        validUntil.bits.fill_with_bits_of_field_element(pb, order.validUntil);
        validUntil.generate_r1cs_witness_from_bits();

        allOrNone.bits.fill_with_bits_of_field_element(pb, order.allOrNone);
        allOrNone.generate_r1cs_witness_from_bits();

        waiveFeePercentage.bits.fill_with_bits_of_field_element(pb, order.waiveFeePercentage);
        waiveFeePercentage.generate_r1cs_witness_from_bits();

        pb.val(tokenS) = order.tokenS;
        pb.val(tokenB) = order.tokenB;
        tokenF.bits.fill_with_bits_of_field_element(pb, order.tokenF);
        tokenF.generate_r1cs_witness_from_bits();

        pb.val(filledBefore) = order.filledBefore;
        pb.val(cancelled) = order.cancelled;

        pb.val(balanceS) = order.balanceS;
        pb.val(balanceB) = order.balanceB;
        pb.val(balanceF) = order.balanceF;

        pb.val(publicKey.x) = order.publicKey.x;
        pb.val(publicKey.y) = order.publicKey.y;

        pb.val(walletPublicKey.x) = order.walletPublicKey.x;
        pb.val(walletPublicKey.y) = order.walletPublicKey.y;
        pb.val(minerPublicKeyF.x) = order.minerPublicKeyF.x;
        pb.val(minerPublicKeyF.y) = order.minerPublicKeyF.y;
        pb.val(minerPublicKeyS.x) = order.minerPublicKeyS.x;
        pb.val(minerPublicKeyS.y) = order.minerPublicKeyS.y;

        signatureVerifier.generate_r1cs_witness(order.signature);

        validSince_leq_timestamp.generate_r1cs_witness();
        timestamp_leq_validUntil.generate_r1cs_witness();

        pb.val(valid) = order.valid;
    }

    void generate_r1cs_constraints()
    {
        walletID.generate_r1cs_constraints(true);
        orderID.generate_r1cs_constraints(true);
        accountS.generate_r1cs_constraints(true);
        accountB.generate_r1cs_constraints(true);
        accountF.generate_r1cs_constraints(true);
        amountS.generate_r1cs_constraints(true);
        amountB.generate_r1cs_constraints(true);
        amountF.generate_r1cs_constraints(true);
        walletF.generate_r1cs_constraints(true);
        minerF.generate_r1cs_constraints(true);
        minerS.generate_r1cs_constraints(true);
        validSince.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        allOrNone.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        walletSplitPercentage.generate_r1cs_constraints(true);
        waiveFeePercentage.generate_r1cs_constraints(true);

        tokenF.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        validSince_leq_timestamp.generate_r1cs_constraints();
        timestamp_leq_validUntil.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(validSince_leq_timestamp.leq(), timestamp_leq_validUntil.leq(), valid),
                               "validSince_leq_timestamp && timestamp_leq_validUntil = valid");
    }
};

}

#endif
