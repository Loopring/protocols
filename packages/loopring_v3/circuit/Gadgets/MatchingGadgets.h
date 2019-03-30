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

    const Constants& constants;

    VariableT fee;
    VariableT walletSplitPercentage;
    VariableT waiveFeePercentage;

    VariableT matchingFee;

    MulDivGadget walletFee;
    MulDivGadget matchingFeeAfterWaiving;

    FeePaymentCalculator(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& _fee,
        const VariableT& _walletSplitPercentage,
        const VariableT& _waiveFeePercentage,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        fee(_fee),
        walletSplitPercentage(_walletSplitPercentage),
        waiveFeePercentage(_waiveFeePercentage),

        matchingFee(make_variable(pb, FMT(prefix, ".matchingFee"))),

        walletFee(pb, _constants, fee, walletSplitPercentage, constants._100, FMT(prefix, "(amount * walletSplitPercentage) / 100 == walletFee")),
        matchingFeeAfterWaiving(pb, _constants, matchingFee, waiveFeePercentage, constants._100, FMT(prefix, "(matchingFee * waiveFeePercentage) / 100 == matchingFeeAfterWaiving"))
    {

    }

    const VariableT getWalletFee() const
    {
        return walletFee.result();
    }

    const VariableT getMatchingFee() const
    {
        return matchingFeeAfterWaiving.result();
    }

    void generate_r1cs_witness()
    {
        walletFee.generate_r1cs_witness();
        pb.val(matchingFee) = pb.val(fee) - pb.val(walletFee.result());
        matchingFeeAfterWaiving.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        walletFee.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(walletFee.result() + matchingFee, FieldT::one(), fee), "walletFee + matchingFee == fee");
        matchingFeeAfterWaiving.generate_r1cs_constraints();
    }
};

class CheckValidGadget : public GadgetT
{
public:
    const Constants& constants;

    const OrderGadget& order;

    VariableT fillAmountS;
    VariableT fillAmountB;

    LeqGadget fillAmountS_leq_amountS;

    LeqGadget validSince_leq_timestamp;
    LeqGadget timestamp_leq_validUntil;

    RoundingErrorGadget checkRoundingError;
    VariableT validAllOrNone;
    LeqGadget zero_lt_fillAmountS;
    LeqGadget zero_lt_fillAmountB;

    VariableT valid_T;
    VariableT valid_1;
    VariableT valid_2;
    VariableT valid_3;
    VariableT valid_4;
    VariableT valid_5;
    VariableT valid_6;
    VariableT valid;

    CheckValidGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& timestamp,
        const OrderGadget& _order,
        const VariableT& _fillAmountS,
        const VariableT& _fillAmountB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        order(_order),
        fillAmountS(_fillAmountS),
        fillAmountB(_fillAmountB),

        fillAmountS_leq_amountS(pb, fillAmountS, order.amountS.packed, NUM_BITS_AMOUNT * 2, FMT(prefix, ".fillAmountS_eq_amountS")),

        validSince_leq_timestamp(pb, order.validSince.packed, timestamp, NUM_BITS_AMOUNT * 2, FMT(prefix, "validSince <= timestamp")),
        timestamp_leq_validUntil(pb, timestamp, order.validUntil.packed, NUM_BITS_TIMESTAMP, FMT(prefix, "timestamp <= validUntil")),

        checkRoundingError(pb, _constants, _fillAmountS, _order.amountB.packed, _order.amountS.packed, FMT(prefix, ".checkRoundingError")),
        validAllOrNone(make_variable(pb, FMT(prefix, ".validAllOrNone"))),
        zero_lt_fillAmountS(pb, constants.zero, _fillAmountS, NUM_BITS_AMOUNT, FMT(prefix, "0 < _fillAmountS")),
        zero_lt_fillAmountB(pb, constants.zero, _fillAmountB, NUM_BITS_AMOUNT, FMT(prefix, "0 < _fillAmountB")),

        valid_T(make_variable(pb, FMT(prefix, ".valid_T"))),
        valid_1(make_variable(pb, FMT(prefix, ".valid_1"))),
        valid_2(make_variable(pb, FMT(prefix, ".valid_2"))),
        valid_3(make_variable(pb, FMT(prefix, ".valid_3"))),
        valid_4(make_variable(pb, FMT(prefix, ".valid_4"))),
        valid_5(make_variable(pb, FMT(prefix, ".valid_5"))),
        valid_6(make_variable(pb, FMT(prefix, ".valid_6"))),
        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableT& isValid()
    {
        return valid;
    }

    void generate_r1cs_witness ()
    {
        validSince_leq_timestamp.generate_r1cs_witness();
        timestamp_leq_validUntil.generate_r1cs_witness();

        fillAmountS_leq_amountS.generate_r1cs_witness();

        checkRoundingError.generate_r1cs_witness();
        pb.val(validAllOrNone) = FieldT::one() - (pb.val(order.allOrNone.packed) * (pb.val(fillAmountS_leq_amountS.lt())));
        zero_lt_fillAmountS.generate_r1cs_witness();
        zero_lt_fillAmountB.generate_r1cs_witness();

        pb.val(valid_T) = FieldT::one();

        pb.val(valid_1) = pb.val(valid_T) * pb.val(validSince_leq_timestamp.leq());
        pb.val(valid_2) = pb.val(valid_1) * pb.val(timestamp_leq_validUntil.leq());

        pb.val(valid_3) = pb.val(valid_2) * pb.val(checkRoundingError.isValid());
        pb.val(valid_4) = pb.val(valid_3) * pb.val(validAllOrNone);
        pb.val(valid_5) = pb.val(valid_4) * pb.val(zero_lt_fillAmountS.lt());
        pb.val(valid_6) = pb.val(valid_5) * pb.val(zero_lt_fillAmountB.lt());

        pb.val(valid) = pb.val(valid_6);
    }

    void generate_r1cs_constraints()
    {
        validSince_leq_timestamp.generate_r1cs_constraints();
        timestamp_leq_validUntil.generate_r1cs_constraints();

        fillAmountS_leq_amountS.generate_r1cs_constraints();

        checkRoundingError.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(order.allOrNone.packed, fillAmountS_leq_amountS.lt(), FieldT::one() - validAllOrNone),
                               "allOrNone * (fillAmountS < amountS) = !validAllOrNone");
        zero_lt_fillAmountS.generate_r1cs_constraints();
        zero_lt_fillAmountB.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(valid_T, FieldT::one(), FieldT::one()), "valid_T == true");

        pb.add_r1cs_constraint(ConstraintT(valid_T, validSince_leq_timestamp.leq(), valid_1),
                               "valid_T && validSince_leq_timestamp = valid_1");
        pb.add_r1cs_constraint(ConstraintT(valid_1, timestamp_leq_validUntil.leq(), valid_2),
                               "valid_1 && timestamp_leq_validUntil = valid_1");

        pb.add_r1cs_constraint(ConstraintT(valid_2, checkRoundingError.isValid(), valid_3),
                               "valid_2 && checkRoundingError = valid_3");
        pb.add_r1cs_constraint(ConstraintT(valid_3, validAllOrNone, valid_4),
                               "valid_3 && validAllOrNone = valid_4");
        pb.add_r1cs_constraint(ConstraintT(valid_4, zero_lt_fillAmountS.lt(), valid_5),
                               "valid_4 && zero_lt_fillAmountS = valid_5");
        pb.add_r1cs_constraint(ConstraintT(valid_5, zero_lt_fillAmountB.lt(), valid_6),
                               "valid_5 && zero_lt_fillAmountB = valid_6");

        pb.add_r1cs_constraint(ConstraintT(valid_6, FieldT::one(), valid),
                               "valid_6 = valid");
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
        const Constants& constants,
        const OrderGadget& _order,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),

        remainingSBeforeCancelled(make_variable(pb, FMT(prefix, ".remainingSBeforeCancelled"))),
        remainingS(make_variable(pb, FMT(prefix, ".remainingS"))),
        fillAmountS_1(pb, order.balanceS, remainingS, NUM_BITS_AMOUNT, FMT(prefix, ".min(balanceS, remainingS)")),

        fillAmountF(pb, constants, order.amountF.packed, fillAmountS_1.result(), order.amountS.packed,
                    FMT(prefix, ".(amountF * fillAmountS) / amountS")),
        fillAmountS_plus_fillAmountF(make_variable(pb, FMT(prefix, ".fillAmountS_plus_fillAmountF"))),

        amountS_plus_amountF(make_variable(pb, FMT(prefix, ".amountS_plus_amountF"))),
        tokenS_eq_tokenF(pb, order.tokenS.packed, order.tokenF.packed, NUM_BITS_TOKEN, FMT(prefix, ".tokenS == tokenF")),
        balanceS_LT_fillAmountS_plus_fillAmountF(pb, order.balanceS, fillAmountS_plus_fillAmountF, NUM_BITS_AMOUNT + 1, FMT(prefix, ".balanceS < totalAmount")),
        tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF(pb, tokenS_eq_tokenF.eq(), balanceS_LT_fillAmountS_plus_fillAmountF.lt(),
                                                                      FMT(prefix, ".fillAmountS_plus_fillAmountF")),
        fillAmountS_eq(pb, constants, order.balanceS, order.amountS.packed, amountS_plus_amountF,
                       FMT(prefix, ".balanceS * amountS / (amountS + amountF)")),

        tokenS_neq_tokenF(pb, tokenS_eq_tokenF.eq(), FMT(prefix, ".tokenS != tokenF")),
        balanceF_lt_fillAmountF(pb, order.balanceF, fillAmountF.result(), NUM_BITS_AMOUNT, FMT(prefix, ".balanceF < fillAmountF")),
        tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF(pb, tokenS_neq_tokenF.Not(), balanceF_lt_fillAmountF.lt(),
                                                      FMT(prefix, ".tokenS_neq_tokenF AND balanceF_lt_fillAmountF")),
        fillAmountS_neq(pb, constants, order.balanceF, order.amountS.packed, order.amountF.packed,
                        FMT(prefix, ".balanceF * amountS / amountF")),

        tokenB_eq_tokenF(pb, order.tokenB.packed, order.tokenF.packed, NUM_BITS_TOKEN, FMT(prefix, ".tokenB == tokenF")),
        amountF_leq_amountB(pb, order.amountF.packed, order.amountB.packed, NUM_BITS_AMOUNT, FMT(prefix, ".amountF <= amountB")),
        tokenB_eq_tokenF_AND_amountF_leq_amountB(pb, tokenB_eq_tokenF.eq(), amountF_leq_amountB.leq(),
                                                      FMT(prefix, ".tokenB_eq_tokenF AND amountF_leq_amountB")),

        fillAmountS_2(pb, tokenS_eq_tokenF_AND_balanceS_lt_fillAmountS_plus_fillAmountF.And(),
                      fillAmountS_eq.result(), fillAmountS_1.result(), FMT(prefix, ".fillAmountS_2")),
        fillAmountS_3(pb, tokenS_neq_tokenF_AND_balanceF_lt_fillAmountF.And(),
                    fillAmountS_neq.result(), fillAmountS_2.result(), FMT(prefix, ".fillAmountS_3")),
        fillAmountS(pb, tokenB_eq_tokenF_AND_amountF_leq_amountB.And(),
                      fillAmountS_1.result(), fillAmountS_3.result(), FMT(prefix, ".fillAmountS")),

        fillAmountB(pb, constants, fillAmountS.result(), order.amountB.packed, order.amountS.packed, FMT(prefix, ".(fillAmountS * amountB) / amountS"))
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
        pb.val(remainingSBeforeCancelled) = pb.val(order.amountS.packed) - pb.val(order.tradeHistory.getFilled());
        pb.val(remainingS) = (FieldT::one() - pb.val(order.tradeHistory.getCancelled())) * pb.val(remainingSBeforeCancelled);
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

        // print(pb, "amountS", order.amountS.packed);
        // print(pb, "remainingSBeforeCancelled", remainingSBeforeCancelled);
        // print(pb, "remainingS", remainingS);
        // print(pb, "filledBefore", order.filledBefore);
        // print(pb, "order.balanceS", order.balanceS);
        // print(pb, "fillAmountS", fillAmountS.result());
        // print(pb, "fillAmountB", fillAmountB.result());
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(order.tradeHistory.getFilled() + remainingSBeforeCancelled, 1, order.amountS.packed),
                               "filledBefore + remainingSBeforeCancelled = amountS");
        pb.add_r1cs_constraint(ConstraintT(remainingSBeforeCancelled, 1 - order.tradeHistory.getCancelled(), remainingS),
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
    const Constants& constants;

    const OrderGadget& orderA;
    const OrderGadget& orderB;

    MaxFillAmountsGadget maxFillAmountA;
    MaxFillAmountsGadget maxFillAmountB;

    LeqGadget fillAmountB_A_lt_fillAmountS_B;

    VariableT fillAmountS_B_T;
    MulDivGadget fillAmountB_B_T;

    VariableT fillAmountB_A_F;
    MulDivGadget fillAmountS_A_F;

    TernaryGadget fillAmountS_A;
    TernaryGadget fillAmountB_A;
    TernaryGadget fillAmountS_B;
    TernaryGadget fillAmountB_B;

    VariableT margin;

    MulDivGadget fillAmountF_A;
    MulDivGadget fillAmountF_B;

    VariableT totalFee;
    EqualGadget accountsEqual;
    EqualGadget feeTokensEqual;
    LeqGadget balanceF_lt_totalFee;
    AndGadget accounts_and_feeTokensEqual;
    AndGadget selfTradingCheckValid;

    LeqGadget fillAmountS_A_lt_fillAmountB_B;

    CheckValidGadget checkValidA;
    CheckValidGadget checkValidB;

    VariableT valid_1;
    VariableT valid_2;
    VariableT valid;

    OrderMatchingGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& timestamp,
        const OrderGadget& _orderA,
        const OrderGadget& _orderB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),

        orderA(_orderA),
        orderB(_orderB),

        maxFillAmountA(pb, constants, orderA, FMT(prefix, ".maxFillAmountA")),
        maxFillAmountB(pb, constants, orderB, FMT(prefix, ".maxFillAmountB")),

        fillAmountB_A_lt_fillAmountS_B(pb, maxFillAmountA.getAmountB(), maxFillAmountB.getAmountS(), NUM_BITS_AMOUNT * 2,
                                       FMT(prefix, "fillAmountB_A < fillAmountS_B")),

        fillAmountS_B_T(maxFillAmountA.getAmountB()),
        fillAmountB_B_T(pb, constants, fillAmountS_B_T, orderB.amountB.packed, orderB.amountS.packed,
                        FMT(prefix, "fillAmountB_B = (fillAmountS_B * orderB.amountB) // orderB.amountS")),

        fillAmountB_A_F(maxFillAmountB.getAmountS()),
        fillAmountS_A_F(pb, constants, fillAmountB_A_F, orderA.amountS.packed, orderA.amountB.packed,
                        FMT(prefix, "fillAmountS_A = (fillAmountB_A * orderA.amountS) // orderA.amountB")),

        fillAmountS_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountS(), fillAmountS_A_F.result(), FMT(prefix, "fillAmountS_A")),
        fillAmountB_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountB(), fillAmountB_A_F, FMT(prefix, "fillAmountB_A")),
        fillAmountS_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountS_B_T, maxFillAmountB.getAmountS(), FMT(prefix, "fillAmountS_B")),
        fillAmountB_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountB_B_T.result(), maxFillAmountB.getAmountB(), FMT(prefix, "fillAmountB_B")),

        margin(make_variable(pb, FMT(prefix, ".margin"))),

        fillAmountF_A(pb, constants, orderA.amountF.packed, fillAmountS_A.result(), orderA.amountS.packed,
                      FMT(prefix, "fillAmountF_A = (orderA.amountF * fillAmountS_A) // orderA.amountS")),
        fillAmountF_B(pb, constants, orderB.amountF.packed, fillAmountS_B.result(), orderB.amountS.packed,
                      FMT(prefix, "fillAmountF_B = (orderB.amountF * fillAmountS_B) // orderB.amountS")),

        totalFee(make_variable(pb, FMT(prefix, ".totalFee"))),
        accountsEqual(pb, orderA.accountID.packed, orderB.accountID.packed, NUM_BITS_ACCOUNT,
                      FMT(prefix, "orderA.accountID == orderB.accountID")),
        feeTokensEqual(pb, orderA.tokenF.packed, orderB.tokenF.packed, NUM_BITS_TOKEN,
                      FMT(prefix, "orderA.tokenF == orderB.tokenF")),
        balanceF_lt_totalFee(pb, orderA.balanceF, totalFee, NUM_BITS_AMOUNT,
                             FMT(prefix, ".balanceF < totalFee")),
        accounts_and_feeTokensEqual(pb, accountsEqual.eq(), feeTokensEqual.eq(), FMT(prefix, ".accountsEqual && feeTokensEqual")),
        selfTradingCheckValid(pb, accounts_and_feeTokensEqual.And(), balanceF_lt_totalFee.lt(), FMT(prefix, ".accountsEqual && feeTokensEqual")),

        fillAmountS_A_lt_fillAmountB_B(pb, fillAmountS_A.result(), fillAmountB_B.result(), NUM_BITS_AMOUNT,
                                       FMT(prefix, "fillAmountS_A < fillAmountB_B")),

        checkValidA(pb, constants, timestamp, orderA, fillAmountS_A.result(), fillAmountB_A.result(), FMT(prefix, ".checkValidA")),
        checkValidB(pb, constants, timestamp, orderB, fillAmountS_B.result(), fillAmountB_B.result(), FMT(prefix, ".checkValidB")),

        valid_1(make_variable(pb, FMT(prefix, ".valid_1"))),
        valid_2(make_variable(pb, FMT(prefix, ".valid_2"))),
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

        fillAmountB_B_T.generate_r1cs_witness();
        fillAmountS_A_F.generate_r1cs_witness();

        fillAmountS_A.generate_r1cs_witness();
        fillAmountB_A.generate_r1cs_witness();
        fillAmountS_B.generate_r1cs_witness();
        fillAmountB_B.generate_r1cs_witness();

        pb.val(margin) = pb.val(fillAmountS_A.result()) - pb.val(fillAmountB_B.result());

        fillAmountF_A.generate_r1cs_witness();
        fillAmountF_B.generate_r1cs_witness();

        pb.val(totalFee) = pb.val(fillAmountF_A.result()) + pb.val(fillAmountF_B.result());
        accountsEqual.generate_r1cs_witness();
        feeTokensEqual.generate_r1cs_witness();
        balanceF_lt_totalFee.generate_r1cs_witness();
        accounts_and_feeTokensEqual.generate_r1cs_witness();
        selfTradingCheckValid.generate_r1cs_witness();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_witness();

        checkValidA.generate_r1cs_witness();
        checkValidB.generate_r1cs_witness();

        pb.val(valid_1) = pb.val(checkValidA.isValid()) * pb.val(checkValidB.isValid());
        pb.val(valid_2) = pb.val(valid_1) * (FieldT::one() - pb.val(selfTradingCheckValid.And()));
        pb.val(valid) = pb.val(valid_2) * (FieldT::one() - pb.val(fillAmountS_A_lt_fillAmountB_B.lt()));

        // print(pb, "margin", margin);
    }

    void generate_r1cs_constraints()
    {
        // Check if tokenS/tokenB match
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenS.packed, 1, orderB.tokenB.packed), "orderA.tokenS == orderB.tokenB");
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenB.packed, 1, orderB.tokenS.packed), "orderA.tokenB == orderB.tokenS");

        maxFillAmountA.generate_r1cs_constraints();
        maxFillAmountB.generate_r1cs_constraints();

        fillAmountB_A_lt_fillAmountS_B.generate_r1cs_constraints();

        fillAmountB_B_T.generate_r1cs_constraints();
        fillAmountS_A_F.generate_r1cs_constraints();

        fillAmountS_A.generate_r1cs_constraints();
        fillAmountB_A.generate_r1cs_constraints();
        fillAmountS_B.generate_r1cs_constraints();
        fillAmountB_B.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(fillAmountB_B.result() + margin, 1, fillAmountS_A.result()), "fillAmountB_B + margin = fillAmountS_A");

        fillAmountF_A.generate_r1cs_constraints();
        fillAmountF_B.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(fillAmountF_A.result() + fillAmountF_B.result(), 1, totalFee), "fillAmountF_A + fillAmountF_B = totalFee");
        accountsEqual.generate_r1cs_constraints();
        feeTokensEqual.generate_r1cs_constraints();
        balanceF_lt_totalFee.generate_r1cs_constraints();
        accounts_and_feeTokensEqual.generate_r1cs_constraints();
        selfTradingCheckValid.generate_r1cs_constraints();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_constraints();

        checkValidA.generate_r1cs_constraints();
        checkValidB.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(checkValidA.isValid(), checkValidB.isValid(), valid_1), "checkValidA.isValid() * checkValidB.isValid() = valid_1");
        pb.add_r1cs_constraint(ConstraintT(valid_1, FieldT::one() - selfTradingCheckValid.And(), valid_2), "valid_1 * selfTradingCheckValid = valid");
        pb.add_r1cs_constraint(ConstraintT(FieldT::one() - fillAmountS_A_lt_fillAmountB_B.lt(), valid_2, valid), "fillAmountS_A_lt_fillAmountB_B * fillsValid = valid");
    }
};


}

#endif
