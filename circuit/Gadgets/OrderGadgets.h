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

    VariableT blockStateID;

    libsnark::dual_variable_gadget<FieldT> padding;

    libsnark::dual_variable_gadget<FieldT> stateID;
    libsnark::dual_variable_gadget<FieldT> walletID;
    libsnark::dual_variable_gadget<FieldT> orderID;
    libsnark::dual_variable_gadget<FieldT> accountID;
    libsnark::dual_variable_gadget<FieldT> dualAuthAccountID;
    libsnark::dual_variable_gadget<FieldT> tokenS;
    libsnark::dual_variable_gadget<FieldT> tokenB;
    libsnark::dual_variable_gadget<FieldT> tokenF;
    libsnark::dual_variable_gadget<FieldT> amountS;
    libsnark::dual_variable_gadget<FieldT> amountB;
    libsnark::dual_variable_gadget<FieldT> amountF;

    libsnark::dual_variable_gadget<FieldT> allOrNone;
    libsnark::dual_variable_gadget<FieldT> validSince;
    libsnark::dual_variable_gadget<FieldT> validUntil;
    libsnark::dual_variable_gadget<FieldT> walletSplitPercentage;
    libsnark::dual_variable_gadget<FieldT> waiveFeePercentage;

    const jubjub::VariablePointT publicKey;
    const jubjub::VariablePointT walletPublicKey;

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
        const VariableT& _blockStateID,
        const VariableT& timestamp,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        blockStateID(_blockStateID),

        padding(pb, 1, FMT(prefix, ".padding")),

        stateID(pb, 16, FMT(prefix, ".stateID")),
        walletID(pb, 12, FMT(prefix, ".walletID")),
        orderID(pb, TREE_DEPTH_TRADING_HISTORY, FMT(prefix, ".orderID")),
        accountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID")),
        dualAuthAccountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".dualAuthAccountID")),
        tokenS(pb, 12, FMT(prefix, ".tokenS")),
        tokenB(pb, 12, FMT(prefix, ".tokenB")),
        tokenF(pb, 12, FMT(prefix, ".tokenF")),
        amountS(pb, 96, FMT(prefix, ".amountS")),
        amountB(pb, 96, FMT(prefix, ".amountB")),
        amountF(pb, 96, FMT(prefix, ".amountF")),

        allOrNone(pb, 1, FMT(prefix, ".allOrNone")),
        validSince(pb, 32, FMT(prefix, ".validSince")),
        validUntil(pb, 32, FMT(prefix, ".validUntil")),
        walletSplitPercentage(pb, 7, FMT(prefix, ".walletSplitPercentage")),
        waiveFeePercentage(pb, 7, FMT(prefix, ".waiveFeePercentage")),

        publicKey(pb, FMT(prefix, ".publicKey")),
        walletPublicKey(pb, FMT(prefix, ".walletPublicKey")),

        filledBefore(make_variable(pb, FMT(prefix, ".filledBefore"))),
        cancelled(make_variable(pb, FMT(prefix, ".cancelled"))),

        balanceS(make_variable(pb, FMT(prefix, ".balanceS"))),
        balanceB(make_variable(pb, FMT(prefix, ".balanceB"))),
        balanceF(make_variable(pb, FMT(prefix, ".balanceF"))),

        signatureVerifier(pb, params, publicKey,
                          flatten({stateID.bits, walletID.bits, orderID.bits, accountID.bits, dualAuthAccountID.bits,
                          tokenS.bits, tokenB.bits, tokenF.bits,
                          amountS.bits, amountB.bits, amountF.bits,
                          allOrNone.bits, validSince.bits, validUntil.bits,
                          walletSplitPercentage.bits}),
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
        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        stateID.bits.fill_with_bits_of_field_element(pb, order.stateID);
        stateID.generate_r1cs_witness_from_bits();
        walletID.bits.fill_with_bits_of_field_element(pb, order.walletID);
        walletID.generate_r1cs_witness_from_bits();
        orderID.bits.fill_with_bits_of_field_element(pb, order.orderID);
        orderID.generate_r1cs_witness_from_bits();
        accountID.bits.fill_with_bits_of_field_element(pb, order.accountID);
        accountID.generate_r1cs_witness_from_bits();
        dualAuthAccountID.bits.fill_with_bits_of_field_element(pb, order.dualAuthAccountID);
        dualAuthAccountID.generate_r1cs_witness_from_bits();

        tokenS.bits.fill_with_bits_of_field_element(pb, order.tokenS);
        tokenS.generate_r1cs_witness_from_bits();
        tokenB.bits.fill_with_bits_of_field_element(pb, order.tokenB);
        tokenB.generate_r1cs_witness_from_bits();
        tokenF.bits.fill_with_bits_of_field_element(pb, order.tokenF);
        tokenF.generate_r1cs_witness_from_bits();

        amountS.bits.fill_with_bits_of_field_element(pb, order.amountS);
        amountS.generate_r1cs_witness_from_bits();
        amountB.bits.fill_with_bits_of_field_element(pb, order.amountB);
        amountB.generate_r1cs_witness_from_bits();
        amountF.bits.fill_with_bits_of_field_element(pb, order.amountF);
        amountF.generate_r1cs_witness_from_bits();

        allOrNone.bits.fill_with_bits_of_field_element(pb, order.allOrNone);
        allOrNone.generate_r1cs_witness_from_bits();
        validSince.bits.fill_with_bits_of_field_element(pb, order.validSince);
        validSince.generate_r1cs_witness_from_bits();
        validUntil.bits.fill_with_bits_of_field_element(pb, order.validUntil);
        validUntil.generate_r1cs_witness_from_bits();
        walletSplitPercentage.bits.fill_with_bits_of_field_element(pb, order.walletSplitPercentage);
        walletSplitPercentage.generate_r1cs_witness_from_bits();
        waiveFeePercentage.bits.fill_with_bits_of_field_element(pb, order.waiveFeePercentage);
        waiveFeePercentage.generate_r1cs_witness_from_bits();

        pb.val(filledBefore) = order.filledBefore;
        pb.val(cancelled) = order.cancelled;
        print("Cancelled: ", order.cancelled);

        pb.val(balanceS) = order.balanceS;
        pb.val(balanceB) = order.balanceB;
        pb.val(balanceF) = order.balanceF;

        pb.val(publicKey.x) = order.publicKey.x;
        pb.val(publicKey.y) = order.publicKey.y;

        pb.val(walletPublicKey.x) = order.walletPublicKey.x;
        pb.val(walletPublicKey.y) = order.walletPublicKey.y;

        signatureVerifier.generate_r1cs_witness(order.signature);

        validSince_leq_timestamp.generate_r1cs_witness();
        timestamp_leq_validUntil.generate_r1cs_witness();

        pb.val(valid) = order.valid;
    }

    void generate_r1cs_constraints()
    {
        forceEqual(pb, blockStateID, stateID.packed, FMT(annotation_prefix, ".blockStateID == stateID"));

        padding.generate_r1cs_constraints(true);

        stateID.generate_r1cs_constraints(true);
        walletID.generate_r1cs_constraints(true);
        orderID.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        dualAuthAccountID.generate_r1cs_constraints(true);

        tokenS.generate_r1cs_constraints(true);
        tokenB.generate_r1cs_constraints(true);
        tokenF.generate_r1cs_constraints(true);
        amountS.generate_r1cs_constraints(true);
        amountB.generate_r1cs_constraints(true);
        amountF.generate_r1cs_constraints(true);

        allOrNone.generate_r1cs_constraints(true);
        validSince.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        walletSplitPercentage.generate_r1cs_constraints(true);
        waiveFeePercentage.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        validSince_leq_timestamp.generate_r1cs_constraints();
        timestamp_leq_validUntil.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(validSince_leq_timestamp.leq(), timestamp_leq_validUntil.leq(), valid),
                               FMT(annotation_prefix, ".validSince_leq_timestamp && timestamp_leq_validUntil = valid"));
    }
};

}

#endif
