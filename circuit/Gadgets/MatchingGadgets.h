#ifndef _MATCHINGGADGETS_H_
#define _MATCHINGGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "MathGadgets.h"
#include "OrderGadgets.h"
#include "TradingHistoryGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

class FeePaymentCalculator : public GadgetT
{
public:

    VariableT constant1000;
    VariableT constant100;

    VariableT fee;
    VariableT burnRate;
    VariableT walletSplitPercentage;
    VariableT waiveFeePercentage;

    VariableT matchingFee;
    VariableT walletFeeToPay;
    VariableT matchingFeeToPay;
    VariableT feeToBurn;

    MulDivGadget walletFee;
    MulDivGadget walletFeeToBurn;
    MulDivGadget matchingFeeAfterWaiving;
    MulDivGadget matchingFeeToBurn;

    FeePaymentCalculator(
        ProtoboardT& pb,
        const VariableT& _fee,
        const VariableT& _burnRate,
        const VariableT& _walletSplitPercentage,
        const VariableT& _waiveFeePercentage,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant100(make_variable(pb, 100, FMT(prefix, ".constant100"))),
        constant1000(make_variable(pb, 1000, FMT(prefix, ".constant1000"))),

        fee(_fee),
        burnRate(_burnRate),
        walletSplitPercentage(_walletSplitPercentage),
        waiveFeePercentage(_waiveFeePercentage),

        matchingFee(make_variable(pb, FMT(prefix, ".matchingFee"))),
        walletFeeToPay(make_variable(pb, FMT(prefix, ".walletFeeToPay"))),
        matchingFeeToPay(make_variable(pb, FMT(prefix, ".matchingFeeToPay"))),
        feeToBurn(make_variable(pb, FMT(prefix, ".feeToBurn"))),

        walletFee(pb, fee, walletSplitPercentage, constant100, FMT(prefix, "(amount * walletSplitPercentage) / 100 == walletFee")),
        walletFeeToBurn(pb, walletFee.result(), burnRate, constant1000, FMT(prefix, "(walletFee * burnRate) / 1000 == walletFeeToBurn")),
        matchingFeeAfterWaiving(pb, matchingFee, waiveFeePercentage, constant100, FMT(prefix, "(matchingFee * waiveFeePercentage) / 100 == matchingFeeAfterWaiving")),
        matchingFeeToBurn(pb, matchingFeeAfterWaiving.result(), burnRate, constant1000, FMT(prefix, "(matchingFeeAfterWaiving * burnRate) / 1000 == matchingFeeToBurn"))
    {

    }

    const VariableT getWalletFee() const
    {
        return walletFeeToPay;
    }

    const VariableT getMatchingFee() const
    {
        return matchingFeeToPay;
    }

    const VariableT getBurnFee() const
    {
        return feeToBurn;
    }

    void generate_r1cs_witness()
    {
        walletFee.generate_r1cs_witness();
        walletFeeToBurn.generate_r1cs_witness();
        pb.val(walletFeeToPay) = pb.val(walletFee.result()) - pb.val(walletFeeToBurn.result());

        pb.val(matchingFee) = pb.val(fee) - pb.val(walletFee.result());
        matchingFeeAfterWaiving.generate_r1cs_witness();
        matchingFeeToBurn.generate_r1cs_witness();
        pb.val(matchingFeeToPay) = pb.val(matchingFeeAfterWaiving.result()) - pb.val(matchingFeeToBurn.result());

        pb.val(feeToBurn) = pb.val(walletFeeToBurn.result()) + pb.val(matchingFeeToBurn.result());
    }

    void generate_r1cs_constraints()
    {
        walletFee.generate_r1cs_constraints();
        walletFeeToBurn.generate_r1cs_constraints();
        matchingFeeAfterWaiving.generate_r1cs_constraints();
        matchingFeeToBurn.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(walletFeeToPay + walletFeeToBurn.result(), FieldT::one(), walletFee.result()), "walletFeeToPay + walletFeeToBurn == walletFee");
        pb.add_r1cs_constraint(ConstraintT(walletFee.result() + matchingFee, FieldT::one(), fee), "walletFee + matchingFee == fee");
        pb.add_r1cs_constraint(ConstraintT(matchingFeeToPay + matchingFeeToBurn.result(), FieldT::one(), matchingFeeAfterWaiving.result()), "matchingFeeToPay + matchingFeeToBurn == matchingFeeAfterWaiving");
        pb.add_r1cs_constraint(ConstraintT(walletFeeToBurn.result() + matchingFeeToBurn.result(), FieldT::one(), feeToBurn), "walletFeeToBurn + matchingFeeToBurn == feeToBurn");
    }
};

class CheckBurnRateGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifier;

    CheckBurnRateGadget(
        ProtoboardT& pb,
        const VariableT& merkleRoot,
        const VariableArrayT& address,
        const VariableT& burnRate,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        proof(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".proof"))),
        proofVerifier(pb, TREE_DEPTH_TOKENS, address, merkle_tree_IVs(pb), burnRate, merkleRoot, proof, FMT(prefix, ".path"))
    {

    }

    void generate_r1cs_witness(const Proof& _proof)
    {
        proof.fill_with_field_elements(pb, _proof.data);
        proofVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        proofVerifier.generate_r1cs_constraints();
    }
};

class MaxFillAmountsGadget : public GadgetT
{
public:
    const OrderGadget& order;

    VariableT remainingS;
    LeqGadget balanceS_lt_remainingS;
    TernaryGadget fillAmountS;
    MulDivGadget fillAmountB;

    MaxFillAmountsGadget(
        ProtoboardT& pb,
        const OrderGadget& _order,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),

        remainingS(make_variable(pb, FMT(prefix, ".remainingS"))),
        balanceS_lt_remainingS(pb, order.balanceS, remainingS, FMT(prefix, ".(spendableS < remainingS)")),
        fillAmountS(pb, balanceS_lt_remainingS.lt(), order.balanceS, remainingS, FMT(prefix, "fillAmountS = (balanceS < remainingS) ? balanceS : remainingS")),
        fillAmountB(pb, fillAmountS.result(), order.amountB.packed, order.amountS.packed, FMT(prefix, "(fillAmountS * amountB) / amountS"))
    {

    }

    const VariableT& getAmountS()
    {
        return fillAmountS.result();
    }

    const VariableT& getAmountB()
    {
        return fillAmountB.result();
    }

    void generate_r1cs_witness()
    {
        pb.val(remainingS) = pb.val(order.amountS.packed) - pb.val(order.filledBefore);
        balanceS_lt_remainingS.generate_r1cs_witness();
        fillAmountS.generate_r1cs_witness();
        fillAmountB.generate_r1cs_witness();
        print(pb, "amountS", order.amountS.packed);
        print(pb, "remainingS", remainingS);
        print(pb, "filledBefore", order.filledBefore);
        print(pb, "order.balanceS", order.balanceS);
        print(pb, "fillAmountS", fillAmountS.result());
        print(pb, "fillAmountB", fillAmountB.result());
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(order.filledBefore + remainingS, 1, order.amountS.packed), "filledBeforeA + remainingS = amountS");
        balanceS_lt_remainingS.generate_r1cs_constraints();
        fillAmountS.generate_r1cs_constraints();
        fillAmountB.generate_r1cs_constraints();
    }
};




class OrderMatchingGadget : public GadgetT
{
public:
    const OrderGadget& orderA;
    const OrderGadget& orderB;

    MaxFillAmountsGadget maxFillAmountA;
    MaxFillAmountsGadget maxFillAmountB;

    LeqGadget fillAmountB_A_lt_fillAmountS_B;

    VariableT fillAmountB_B_T;
    MulDivGadget fillAmountS_B_T;

    VariableT fillAmountB_A_F;
    MulDivGadget fillAmountS_A_F;

    TernaryGadget fillAmountS_A;
    TernaryGadget fillAmountB_A;
    TernaryGadget fillAmountS_B;
    TernaryGadget fillAmountB_B;

    VariableT margin;

    MulDivGadget fillAmountF_A;
    MulDivGadget fillAmountF_B;

    LeqGadget fillAmountS_A_lt_fillAmountB_B;

    CheckFillsGadget checkFillsA;
    CheckFillsGadget checkFillsB;

    VariableT fillsValid;
    VariableT valid;

    OrderMatchingGadget(
        ProtoboardT& pb,
        const OrderGadget& _orderA,
        const OrderGadget& _orderB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        orderA(_orderA),
        orderB(_orderB),

        maxFillAmountA(pb, orderA, FMT(prefix, ".maxFillAmountA")),
        maxFillAmountB(pb, orderB, FMT(prefix, ".maxFillAmountB")),

        fillAmountB_A_lt_fillAmountS_B(pb, maxFillAmountA.getAmountB(), maxFillAmountB.getAmountS(),
                                       FMT(prefix, "fillAmountB_A < fillAmountS_B")),

        fillAmountB_B_T(maxFillAmountA.getAmountS()),
        fillAmountS_B_T(pb, fillAmountB_B_T, orderB.amountS.packed, orderB.amountB.packed,
                        FMT(prefix, "fillAmountS_B = (fillAmountB_B * orderB.amountS) // orderB.amountB")),

        fillAmountB_A_F(maxFillAmountB.getAmountS()),
        fillAmountS_A_F(pb, fillAmountB_A_F, orderA.amountS.packed, orderA.amountB.packed,
                        FMT(prefix, "fillAmountS_A = (fillAmountB_A * orderA.amountS) // orderA.amountB")),

        fillAmountS_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountS(), fillAmountS_A_F.result(), FMT(prefix, "fillAmountS_A")),
        fillAmountB_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountB(), fillAmountB_A_F, FMT(prefix, "fillAmountB_A")),
        fillAmountS_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountS_B_T.result(), maxFillAmountB.getAmountS(), FMT(prefix, "fillAmountS_B")),
        fillAmountB_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountB_B_T, maxFillAmountB.getAmountB(), FMT(prefix, "fillAmountB_B")),

        margin(make_variable(pb, FMT(prefix, ".margin"))),

        fillAmountF_A(pb, orderA.amountF.packed, fillAmountS_A.result(), orderA.amountS.packed,
                      FMT(prefix, "fillAmountF_A = (orderA.amountF * fillAmountS_A) // orderA.amountS")),
        fillAmountF_B(pb, orderB.amountF.packed, fillAmountS_B.result(), orderB.amountS.packed,
                      FMT(prefix, "fillAmountF_B = (orderB.amountF * fillAmountS_B) // orderB.amountS")),

        fillAmountS_A_lt_fillAmountB_B(pb, fillAmountS_A.result(), fillAmountB_B.result(),
                                       FMT(prefix, "fillAmountS_A < fillAmountB_B")),

        checkFillsA(pb, orderA, fillAmountS_A.result(), fillAmountB_A.result(), FMT(prefix, ".checkFillA")),
        checkFillsB(pb, orderB, fillAmountS_B.result(), fillAmountB_B.result(), FMT(prefix, ".checkFillB")),

        fillsValid(make_variable(pb, FMT(prefix, ".fillsValid"))),
        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableT& getFillAmountS_A() const
    {
        return fillAmountS_A.result();
    }

    const VariableT& getFillAmountB_A() const
    {
        return fillAmountB_A.result();
    }

    const VariableT& getFillAmountF_A() const
    {
        return fillAmountF_A.result();
    }

    const VariableT& getFillAmountS_B() const
    {
        return fillAmountS_B.result();
    }

    const VariableT& getFillAmountB_B() const
    {
        return fillAmountB_B.result();
    }

    const VariableT& getFillAmountF_B() const
    {
        return fillAmountF_B.result();
    }

    const VariableT& getMargin() const
    {
        return margin;
    }

    const VariableT& isValid() const
    {
        return valid;
    }

    void generate_r1cs_witness()
    {
        maxFillAmountA.generate_r1cs_witness();
        maxFillAmountB.generate_r1cs_witness();

        fillAmountB_A_lt_fillAmountS_B.generate_r1cs_witness();

        fillAmountS_B_T.generate_r1cs_witness();
        fillAmountS_A_F.generate_r1cs_witness();

        fillAmountS_A.generate_r1cs_witness();
        fillAmountB_A.generate_r1cs_witness();
        fillAmountS_B.generate_r1cs_witness();
        fillAmountB_B.generate_r1cs_witness();

        pb.val(margin) = pb.val(fillAmountS_A.result()) - pb.val(fillAmountB_B.result());

        fillAmountF_A.generate_r1cs_witness();
        fillAmountF_B.generate_r1cs_witness();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_witness();

        checkFillsA.generate_r1cs_witness();
        checkFillsB.generate_r1cs_witness();

        pb.val(fillsValid) = pb.val(checkFillsA.isValid()) * pb.val(checkFillsB.isValid());
        pb.val(valid) = pb.val(fillsValid) * (FieldT::one() - pb.val(fillAmountS_A_lt_fillAmountB_B.lt()));

        print(pb, "margin", margin);
    }

    void generate_r1cs_constraints()
    {
        // Check if tokenS/tokenB match
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenS.packed, 1, orderB.tokenB.packed), "orderA.tokenS == orderB.tokenB");
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenB.packed, 1, orderB.tokenS.packed), "orderA.tokenB == orderB.tokenS");

        maxFillAmountA.generate_r1cs_constraints();
        maxFillAmountB.generate_r1cs_constraints();

        fillAmountB_A_lt_fillAmountS_B.generate_r1cs_constraints();

        fillAmountS_B_T.generate_r1cs_constraints();
        fillAmountS_A_F.generate_r1cs_constraints();

        fillAmountS_A.generate_r1cs_constraints();
        fillAmountB_A.generate_r1cs_constraints();
        fillAmountS_B.generate_r1cs_constraints();
        fillAmountB_B.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(fillAmountB_B.result() + margin, 1, fillAmountS_A.result()), "fillAmountB_B + margin = fillAmountS_A");

        fillAmountF_A.generate_r1cs_constraints();
        fillAmountF_B.generate_r1cs_constraints();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_constraints();

        checkFillsA.generate_r1cs_constraints();
        checkFillsB.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(checkFillsA.isValid(), checkFillsB.isValid(), fillsValid), "checkFillsA.isValid() * checkFillsB.isValid() = fillsValid");
        pb.add_r1cs_constraint(ConstraintT(1 - fillAmountS_A_lt_fillAmountB_B.lt(), fillsValid, valid), "fillAmountS_A_lt_fillAmountB_B * fillsValid = valid");
    }
};


}

#endif
