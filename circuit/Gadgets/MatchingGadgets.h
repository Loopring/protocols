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

    VariableT remainingSBeforeCancelled;
    VariableT remainingS;
    MinGadget fillAmountS_1;
    MulDivGadget fillAmountF;
    VariableT fillAmountS_plus_fillAmountF;
    VariableT amountS_plus_amountF;
    EqualGadget tokenS_eq_tokenF;
    LeqGadget balanceS_LT_fillAmountS_plus_fillAmountF;
    AndGadget tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF;

    LeqGadget balanceF_lt_fillAmountF;
    NotGadget tokenS_neq_tokenF;
    AndGadget tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF;

    EqualGadget tokenB_eq_tokenF;
    LeqGadget amountF_leq_amountB;
    AndGadget tokenB_eq_tokenF_AND_amountF_leq_amountB;

    MulDivGadget fillAmountS_eq;
    MulDivGadget fillAmountS_neq;

    TernaryGadget fillAmountS_2;
    TernaryGadget fillAmountS_3;
    TernaryGadget fillAmountS;

    MulDivGadget fillAmountB;

    MaxFillAmountsGadget(
        ProtoboardT& pb,
        const OrderGadget& _order,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),

        remainingSBeforeCancelled(make_variable(pb, FMT(prefix, ".remainingSBeforeCancelled"))),
        remainingS(make_variable(pb, FMT(prefix, ".remainingS"))),
        fillAmountS_1(pb, order.balanceS, remainingS, FMT(prefix, ".min(balanceS, remainingS)")),

        fillAmountF(pb, order.amountF.packed, fillAmountS_1.result(), order.amountS.packed,
                    FMT(prefix, ".(amountF * fillAmountS) / amountS")),
        fillAmountS_plus_fillAmountF(make_variable(pb, FMT(prefix, ".fillAmountS_plus_fillAmountF"))),

        amountS_plus_amountF(make_variable(pb, FMT(prefix, ".amountS_plus_amountF"))),
        tokenS_eq_tokenF(pb, order.tokenS.packed, order.tokenF.packed, FMT(prefix, ".tokenS == tokenF")),
        balanceS_LT_fillAmountS_plus_fillAmountF(pb, order.balanceS, fillAmountS_plus_fillAmountF, FMT(prefix, ".balanceS < totalAmount")),
        tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF(pb, tokenS_eq_tokenF.eq(), balanceS_LT_fillAmountS_plus_fillAmountF.lt(),
                                                                      FMT(prefix, ".fillAmountS_plus_fillAmountF")),
        fillAmountS_eq(pb, order.balanceS, order.amountS.packed, amountS_plus_amountF,
                       FMT(prefix, ".balanceS * amountS / (amountS + amountF)")),

        tokenS_neq_tokenF(pb, tokenS_eq_tokenF.eq(), FMT(prefix, ".tokenS != tokenF")),
        balanceF_lt_fillAmountF(pb, order.balanceF, fillAmountF.result(), FMT(prefix, ".balanceF < fillAmountF")),
        tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF(pb, tokenS_neq_tokenF.Not(), balanceF_lt_fillAmountF.lt(),
                                                      FMT(prefix, ".tokenS_neq_tokenF AND balanceF_lt_fillAmountF")),
        fillAmountS_neq(pb, order.balanceF, order.amountS.packed, order.amountF.packed,
                        FMT(prefix, ".balanceF * amountS / amountF")),

        tokenB_eq_tokenF(pb, order.tokenB.packed, order.tokenF.packed, FMT(prefix, ".tokenB == tokenF")),
        amountF_leq_amountB(pb, order.amountF.packed, order.amountB.packed, FMT(prefix, ".amountF <= amountB")),
        tokenB_eq_tokenF_AND_amountF_leq_amountB(pb, tokenB_eq_tokenF.eq(), amountF_leq_amountB.leq(),
                                                      FMT(prefix, ".tokenB_eq_tokenF AND amountF_leq_amountB")),

        fillAmountS_2(pb, tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF.And(),
                      fillAmountS_eq.result(), fillAmountS_1.result(), FMT(prefix, ".fillAmountS_2")),
        fillAmountS_3(pb, tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF.And(),
                    fillAmountS_neq.result(), fillAmountS_2.result(), FMT(prefix, ".fillAmountS_3")),
        fillAmountS(pb, tokenB_eq_tokenF_AND_amountF_leq_amountB.And(),
                      fillAmountS_1.result(), fillAmountS_3.result(), FMT(prefix, ".fillAmountS")),


        fillAmountB(pb, fillAmountS.result(), order.amountB.packed, order.amountS.packed, FMT(prefix, ".(fillAmountS * amountB) / amountS"))
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
        pb.val(remainingSBeforeCancelled) = pb.val(order.amountS.packed) - pb.val(order.filledBefore);
        pb.val(remainingS) = (FieldT::one() - pb.val(order.cancelled)) * pb.val(remainingSBeforeCancelled);
        fillAmountS_1.generate_r1cs_witness();

        fillAmountF.generate_r1cs_witness();
        pb.val(fillAmountS_plus_fillAmountF) = pb.val(fillAmountS_1.result()) + pb.val(fillAmountF.result());

        pb.val(amountS_plus_amountF) = pb.val(order.amountS.packed) + pb.val(order.amountF.packed);
        tokenS_eq_tokenF.generate_r1cs_witness();
        balanceS_LT_fillAmountS_plus_fillAmountF.generate_r1cs_witness();
        tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF.generate_r1cs_witness();
        fillAmountS_eq.generate_r1cs_witness();

        tokenS_neq_tokenF.generate_r1cs_witness();
        balanceF_lt_fillAmountF.generate_r1cs_witness();
        tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF.generate_r1cs_witness();
        fillAmountS_neq.generate_r1cs_witness();

        tokenB_eq_tokenF.generate_r1cs_witness();
        amountF_leq_amountB.generate_r1cs_witness();
        tokenB_eq_tokenF_AND_amountF_leq_amountB.generate_r1cs_witness();

        fillAmountS_2.generate_r1cs_witness();
        fillAmountS_3.generate_r1cs_witness();
        fillAmountS.generate_r1cs_witness();

        fillAmountB.generate_r1cs_witness();

        print(pb, "amountS", order.amountS.packed);
        print(pb, "remainingSBeforeCancelled", remainingSBeforeCancelled);
        print(pb, "remainingS", remainingS);
        print(pb, "filledBefore", order.filledBefore);
        print(pb, "order.balanceS", order.balanceS);
        print(pb, "fillAmountS", fillAmountS.result());
        print(pb, "fillAmountB", fillAmountB.result());
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(order.filledBefore + remainingSBeforeCancelled, 1, order.amountS.packed),
                               "filledBefore + remainingSBeforeCancelled = amountS");
        pb.add_r1cs_constraint(ConstraintT(remainingSBeforeCancelled, 1 - order.cancelled, remainingS),
                               "remainingSBeforeCancelled * cancelled = remainingS");

        fillAmountS_1.generate_r1cs_constraints();

        fillAmountF.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(fillAmountS_1.result() + fillAmountF.result(), 1, fillAmountS_plus_fillAmountF),
                               "fillAmountS + fillAmountF = fillAmountS_plus_fillAmountF");

        pb.add_r1cs_constraint(ConstraintT(order.amountS.packed + order.amountF.packed, 1, amountS_plus_amountF),
                               "amountS + amountF = amountS + amountF");
        tokenS_eq_tokenF.generate_r1cs_constraints();
        balanceS_LT_fillAmountS_plus_fillAmountF.generate_r1cs_constraints();
        tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF.generate_r1cs_constraints();
        fillAmountS_eq.generate_r1cs_constraints();

        tokenS_neq_tokenF.generate_r1cs_constraints();
        balanceF_lt_fillAmountF.generate_r1cs_constraints();
        tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF.generate_r1cs_constraints();
        fillAmountS_neq.generate_r1cs_constraints();

        tokenB_eq_tokenF.generate_r1cs_constraints();
        amountF_leq_amountB.generate_r1cs_constraints();
        tokenB_eq_tokenF_AND_amountF_leq_amountB.generate_r1cs_constraints();

        fillAmountS_2.generate_r1cs_constraints();
        fillAmountS_3.generate_r1cs_constraints();
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
