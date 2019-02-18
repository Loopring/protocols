#ifndef _TRADINGHISTORYCIRCUIT_H_
#define _TRADINGHISTORYCIRCUIT_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/mimc.hpp"
#include "gadgets/merkle_tree.hpp"
#include "gadgets/sha256_many.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class UpdateTradeHistoryGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    libsnark::dual_variable_gadget<FieldT> fill;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateTradeHistoryGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const VariableArrayT& address,
        const VariableT& filledBefore,
        const VariableT& cancelledBefore,
        const VariableT& filledAfter,
        const VariableT& cancelledAfter,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        merkleRootBefore(_merkleRoot),

        fill(pb, 96, FMT(prefix, ".fill")),

        leafBefore(pb, libsnark::ONE, {filledBefore, cancelledBefore}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {filledAfter, cancelledAfter}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_TRADING_HISTORY, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_TRADING_HISTORY, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_TRADING_HISTORY, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT getNewRoot() const
    {
        return rootCalculatorAfter.result();
    }

    void generate_r1cs_witness(const Proof& _proof)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, _proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class CheckFillsGadget : public GadgetT
{
public:
    const OrderGadget& order;

    VariableT fillAmountS;
    VariableT fillAmountB;

    LeqGadget fillAmountS_leq_amountS;
    VariableT valid;

    CheckFillsGadget(
        ProtoboardT& pb,
        const OrderGadget& _order,
        const VariableT& _fillAmountS,
        const VariableT& _fillAmountB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),
        fillAmountS(_fillAmountS),
        fillAmountB(_fillAmountB),

        fillAmountS_leq_amountS(pb, fillAmountS, order.amountS.packed, FMT(prefix, ".fillAmountS_eq_amountS")),
        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableT& isValid()
    {
        return valid;
    }

    void generate_r1cs_witness ()
    {
        fillAmountS_leq_amountS.generate_r1cs_witness();
        pb.val(valid) = FieldT::one() - (pb.val(order.allOrNone.packed) * (pb.val(fillAmountS_leq_amountS.lt())));
    }

    void generate_r1cs_constraints()
    {
        fillAmountS_leq_amountS.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(order.allOrNone.packed, fillAmountS_leq_amountS.lt(), FieldT::one() - valid),
                               "allOrNone * (fillAmountS < amountS) = !valid");
    }
};

}

#endif
