#ifndef _ORDERGADGETS_H_
#define _ORDERGADGETS_H_

#include "TradingHistoryGadgets.h"
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

    VariableT blockRealmID;

    libsnark::dual_variable_gadget<FieldT> padding;

    libsnark::dual_variable_gadget<FieldT> realmID;
    libsnark::dual_variable_gadget<FieldT> orderID;
    libsnark::dual_variable_gadget<FieldT> accountID;
    VariableArrayT walletAccountID;
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

    libsnark::dual_variable_gadget<FieldT> dualAuthPublicKeyX;
    libsnark::dual_variable_gadget<FieldT> dualAuthPublicKeyY;
    const jubjub::VariablePointT dualAuthPublicKey;

    VariableT tradeHistoryFilled;
    VariableT tradeHistoryCancelled;
    VariableT tradeHistoryOrderID;

    TradeHistoryTrimmingGadget tradeHistory;

    VariableT nonce;

    VariableT balanceS;
    VariableT balanceB;
    VariableT balanceF;

    SignatureVerifier signatureVerifier;

    OrderGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _blockRealmID,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        blockRealmID(_blockRealmID),

        padding(pb, 1, FMT(prefix, ".padding")),

        realmID(pb, 32, FMT(prefix, ".realmID")),
        orderID(pb, 32, FMT(prefix, ".orderID")),
        accountID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountID")),
        walletAccountID(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".walletAccountID"))),
        tokenS(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenS")),
        tokenB(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenB")),
        tokenF(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenF")),
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

        dualAuthPublicKeyX(pb, 254, FMT(prefix, ".dualAuthPublicKeyX")),
        dualAuthPublicKeyY(pb, 254, FMT(prefix, ".dualAuthPublicKeyY")),
        dualAuthPublicKey(dualAuthPublicKeyX.packed, dualAuthPublicKeyY.packed),

        tradeHistoryFilled(make_variable(pb, FMT(prefix, ".tradeHistoryFilled"))),
        tradeHistoryCancelled(make_variable(pb, FMT(prefix, ".tradeHistoryCancelled"))),
        tradeHistoryOrderID(make_variable(pb, FMT(prefix, ".tradeHistoryOrderID"))),

        tradeHistory(pb, tradeHistoryFilled, tradeHistoryCancelled, tradeHistoryOrderID, orderID.packed, FMT(prefix, ".tradeHistory")),

        nonce(make_variable(pb, FMT(prefix, ".nonce"))),

        balanceS(make_variable(pb, FMT(prefix, ".balanceS"))),
        balanceB(make_variable(pb, FMT(prefix, ".balanceB"))),
        balanceF(make_variable(pb, FMT(prefix, ".balanceF"))),

        signatureVerifier(pb, params, publicKey,
                          flatten({realmID.bits, subArray(orderID.bits, 0, 16), accountID.bits, walletAccountID,
                          dualAuthPublicKeyX.bits, dualAuthPublicKeyY.bits,
                          tokenS.bits, tokenB.bits, tokenF.bits,
                          amountS.bits, amountB.bits, amountF.bits,
                          allOrNone.bits, validSince.bits, validUntil.bits,
                          walletSplitPercentage.bits, padding.bits}),
                          FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableArrayT& getHash()
    {
        return signatureVerifier.getHash();
    }


    void generate_r1cs_witness(const Order& order)
    {
        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        realmID.bits.fill_with_bits_of_field_element(pb, order.realmID);
        realmID.generate_r1cs_witness_from_bits();
        orderID.bits.fill_with_bits_of_field_element(pb, order.orderID);
        orderID.generate_r1cs_witness_from_bits();
        accountID.bits.fill_with_bits_of_field_element(pb, order.accountID);
        accountID.generate_r1cs_witness_from_bits();
        walletAccountID.fill_with_bits_of_field_element(pb, order.walletAccountID);
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

        pb.val(tradeHistoryFilled) = order.tradeHistoryFilled;
        pb.val(tradeHistoryCancelled) = order.tradeHistoryCancelled;
        pb.val(tradeHistoryOrderID) = order.tradeHistoryOrderID;

        tradeHistory.generate_r1cs_witness();

        pb.val(nonce) = order.nonce;

        pb.val(balanceS) = order.balanceS;
        pb.val(balanceB) = order.balanceB;
        pb.val(balanceF) = order.balanceF;

        pb.val(publicKey.x) = order.publicKey.x;
        pb.val(publicKey.y) = order.publicKey.y;

        pb.val(walletPublicKey.x) = order.walletPublicKey.x;
        pb.val(walletPublicKey.y) = order.walletPublicKey.y;

        dualAuthPublicKeyX.bits.fill_with_bits_of_field_element(pb, order.dualAuthPublicKey.x);
        dualAuthPublicKeyX.generate_r1cs_witness_from_bits();
        dualAuthPublicKeyY.bits.fill_with_bits_of_field_element(pb, order.dualAuthPublicKey.y);
        dualAuthPublicKeyY.generate_r1cs_witness_from_bits();

        signatureVerifier.generate_r1cs_witness(order.signature);
    }

    void generate_r1cs_constraints()
    {
        forceEqual(pb, blockRealmID, realmID.packed, FMT(annotation_prefix, ".blockRealmID == realmID"));

        padding.generate_r1cs_constraints(true);

        realmID.generate_r1cs_constraints(true);

        accountID.generate_r1cs_constraints(true);

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

        tradeHistory.generate_r1cs_constraints();

        signatureVerifier.generate_r1cs_constraints();
    }
};

}

#endif
