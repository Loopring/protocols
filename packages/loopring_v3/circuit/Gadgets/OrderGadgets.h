#ifndef _ORDERGADGETS_H_
#define _ORDERGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "TradingHistoryGadgets.h"
#include "AccountGadgets.h"

#include "ethsnarks.hpp"
#include "gadgets/poseidon.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class OrderGadget : public GadgetT
{
public:
    // Inputs
    DualVariableGadget orderID;
    DualVariableGadget accountID;
    DualVariableGadget tokenS;
    DualVariableGadget tokenB;
    DualVariableGadget amountS;
    DualVariableGadget amountB;
    DualVariableGadget allOrNone;
    DualVariableGadget validSince;
    DualVariableGadget validUntil;
    DualVariableGadget maxFeeBips;
    DualVariableGadget buy;

    DualVariableGadget feeBips;
    DualVariableGadget rebateBips;

    // Checks
    RequireZeroAorBGadget feeOrRebateZero;
    RequireLeqGadget feeBips_leq_maxFeeBips;
    RequireNotEqualGadget tokenS_neq_tokenB;
    RequireNotZeroGadget amountS_notZero;
    RequireNotZeroGadget amountB_notZero;

    // FeeOrRebate public input
    IsNonZero bRebateNonZero;
    UnsafeAddGadget fee_plus_rebate;
    libsnark::dual_variable_gadget<FieldT> feeOrRebateBips;

    // Signature
    Poseidon_gadget_T<13, 1, 6, 53, 12, 1> hash;

    OrderGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& blockExchange,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        // Inputs
        orderID(pb, NUM_BITS_ORDERID, FMT(prefix, ".orderID")),
        accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        tokenS(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenS")),
        tokenB(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenB")),
        amountS(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountS")),
        amountB(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountB")),
        allOrNone(pb, 1, FMT(prefix, ".allOrNone")),
        validSince(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validSince")),
        validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
        maxFeeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".maxFeeBips")),
        buy(pb, 1, FMT(prefix, ".buy")),

        feeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".feeBips")),
        rebateBips(pb, NUM_BITS_BIPS, FMT(prefix, ".rebateBips")),

        // Checks
        feeOrRebateZero(pb, feeBips.packed, rebateBips.packed, FMT(prefix, ".feeOrRebateZero")),
        feeBips_leq_maxFeeBips(pb, feeBips.packed, maxFeeBips.packed, NUM_BITS_BIPS, FMT(prefix, ".feeBips <= maxFeeBips")),
        tokenS_neq_tokenB(pb, tokenS.packed, tokenB.packed, FMT(prefix, ".tokenS != tokenB")),
        amountS_notZero(pb, amountS.packed, FMT(prefix, ".amountS != 0")),
        amountB_notZero(pb, amountB.packed, FMT(prefix, ".amountB != 0")),

        // FeeOrRebate public input
        fee_plus_rebate(pb, feeBips.packed, rebateBips.packed, FMT(prefix, ".fee_plus_rebate")),
        feeOrRebateBips(pb, fee_plus_rebate.result(), NUM_BITS_BIPS, FMT(prefix, ".feeOrRebateBips")),
        bRebateNonZero(pb, rebateBips.packed, FMT(prefix, ".bRebateNonZero")),

        // Signature
        hash(pb, var_array({
            blockExchange,
            orderID.packed,
            accountID.packed,
            tokenS.packed,
            tokenB.packed,
            amountS.packed,
            amountB.packed,
            allOrNone.packed,
            validSince.packed,
            validUntil.packed,
            maxFeeBips.packed,
            buy.packed
        }), FMT(this->annotation_prefix, ".hash"))
    {

    }

    void generate_r1cs_witness(const Order& order)
    {
        // Inputs
        orderID.generate_r1cs_witness(pb, order.orderID);
        accountID.generate_r1cs_witness(pb, order.accountID);
        tokenS.generate_r1cs_witness(pb, order.tokenS);
        tokenB.generate_r1cs_witness(pb, order.tokenB);
        amountS.generate_r1cs_witness(pb, order.amountS);
        amountB.generate_r1cs_witness(pb, order.amountB);
        allOrNone.generate_r1cs_witness(pb, order.allOrNone);
        validSince.generate_r1cs_witness(pb, order.validSince);
        validUntil.generate_r1cs_witness(pb, order.validUntil);
        maxFeeBips.generate_r1cs_witness(pb, order.maxFeeBips);
        buy.generate_r1cs_witness(pb, order.buy);

        feeBips.generate_r1cs_witness(pb, order.feeBips);
        rebateBips.generate_r1cs_witness(pb, order.rebateBips);

        // Checks
        feeOrRebateZero.generate_r1cs_witness();
        feeBips_leq_maxFeeBips.generate_r1cs_witness();
        tokenS_neq_tokenB.generate_r1cs_witness();
        amountS_notZero.generate_r1cs_witness();
        amountB_notZero.generate_r1cs_witness();

        // FeeOrRebate public input
        fee_plus_rebate.generate_r1cs_witness();
        feeOrRebateBips.generate_r1cs_witness_from_packed();
        bRebateNonZero.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();
    }

    void generate_r1cs_constraints(bool doSignatureCheck = true)
    {
        // Inputs
        orderID.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        tokenS.generate_r1cs_constraints(true);
        tokenB.generate_r1cs_constraints(true);
        amountS.generate_r1cs_constraints(true);
        amountB.generate_r1cs_constraints(true);
        allOrNone.generate_r1cs_constraints(true);
        validSince.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        maxFeeBips.generate_r1cs_constraints(true);
        buy.generate_r1cs_constraints(true);

        feeBips.generate_r1cs_constraints(true);
        rebateBips.generate_r1cs_constraints(true);

        // Checks
        feeOrRebateZero.generate_r1cs_constraints();
        feeBips_leq_maxFeeBips.generate_r1cs_constraints();
        tokenS_neq_tokenB.generate_r1cs_constraints();
        amountS_notZero.generate_r1cs_constraints();
        amountB_notZero.generate_r1cs_constraints();

        // FeeOrRebate public input
        fee_plus_rebate.generate_r1cs_constraints();
        feeOrRebateBips.generate_r1cs_constraints(true);
        bRebateNonZero.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();
    }

    const VariableT& hasRebate() const
    {
        return bRebateNonZero.result();
    }
};

}

#endif
