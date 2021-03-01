// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _MATCHINGGADGETS_H_
#define _MATCHINGGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "MathGadgets.h"
#include "OrderGadgets.h"
#include "StorageGadgets.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;

namespace Loopring
{

// Checks if the fill rate <= 0.1% worse than the target rate
// (fillAmountS/fillAmountB) * 1000 <= (amountS/amountB) * 1001
// (fillAmountS * amountB * 1000) <= (fillAmountB * amountS * 1001)
// Also checks that not just a single fill is non-zero.
class RequireFillRateGadget : public GadgetT
{
  public:
    UnsafeMulGadget fillAmountS_mul_amountB;
    UnsafeMulGadget fillAmountS_mul_amountB_mul_1000;
    UnsafeMulGadget fillAmountB_mul_amountS;
    UnsafeMulGadget fillAmountB_mul_amountS_mul_1001;
    RequireLeqGadget validRate;

    IsNonZero isNonZeroFillAmountS;
    IsNonZero isNonZeroFillAmountB;
    AndGadget fillsNonZero;
    NotGadget isZeroFillAmountS;
    NotGadget isZeroFillAmountB;
    AndGadget fillsZero;
    OrGadget fillsValid;
    RequireEqualGadget requireFillsValid;

    RequireFillRateGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &amountS,
      const VariableT &amountB,
      const VariableT &fillAmountS,
      const VariableT &fillAmountB,
      unsigned int n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          fillAmountS_mul_amountB( //
            pb,
            fillAmountS,
            amountB,
            FMT(prefix, ".fillAmountS_mul_amountB")),
          fillAmountS_mul_amountB_mul_1000(
            pb,
            fillAmountS_mul_amountB.result(),
            constants._1000,
            FMT(prefix, ".fillAmountS_mul_amountB_mul_1000")),
          fillAmountB_mul_amountS(pb, fillAmountB, amountS, FMT(prefix, ".fillAmountB_mul_amountS")),
          fillAmountB_mul_amountS_mul_1001(
            pb,
            fillAmountB_mul_amountS.result(),
            constants._1001,
            FMT(prefix, ".fillAmountB_mul_amountS_mul_1001")),
          validRate(
            pb,
            fillAmountS_mul_amountB_mul_1000.result(),
            fillAmountB_mul_amountS_mul_1001.result(),
            n * 2 + 10 /*=ceil(log2(1000))*/,
            FMT(prefix, ".validRate")),

          // Also enforce that either both fill amounts are zero or both are
          // non-zero.
          isNonZeroFillAmountS(pb, fillAmountS, FMT(prefix, "isNonZeroFillAmountS")),
          isNonZeroFillAmountB(pb, fillAmountB, FMT(prefix, "isNonZeroFillAmountB")),
          fillsNonZero(pb, {isNonZeroFillAmountS.result(), isNonZeroFillAmountB.result()}, FMT(prefix, "fillsNonZero")),
          isZeroFillAmountS(pb, isNonZeroFillAmountS.result(), FMT(prefix, "isZeroFillAmountS")),
          isZeroFillAmountB(pb, isNonZeroFillAmountB.result(), FMT(prefix, "isZeroFillAmountB")),
          fillsZero(pb, {isZeroFillAmountS.result(), isZeroFillAmountB.result()}, FMT(prefix, "fillsZero")),
          fillsValid(pb, {fillsNonZero.result(), fillsZero.result()}, FMT(prefix, "fillsValid")),
          requireFillsValid(pb, fillsValid.result(), constants._1, FMT(prefix, "requireFillsValid"))
    {
    }

    void generate_r1cs_witness()
    {
        fillAmountS_mul_amountB.generate_r1cs_witness();
        fillAmountS_mul_amountB_mul_1000.generate_r1cs_witness();
        fillAmountB_mul_amountS.generate_r1cs_witness();
        fillAmountB_mul_amountS_mul_1001.generate_r1cs_witness();
        validRate.generate_r1cs_witness();

        isNonZeroFillAmountS.generate_r1cs_witness();
        isNonZeroFillAmountB.generate_r1cs_witness();
        fillsNonZero.generate_r1cs_witness();
        isZeroFillAmountS.generate_r1cs_witness();
        isZeroFillAmountB.generate_r1cs_witness();
        fillsZero.generate_r1cs_witness();
        fillsValid.generate_r1cs_witness();
        requireFillsValid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        fillAmountS_mul_amountB.generate_r1cs_constraints();
        fillAmountS_mul_amountB_mul_1000.generate_r1cs_constraints();
        fillAmountB_mul_amountS.generate_r1cs_constraints();
        fillAmountB_mul_amountS_mul_1001.generate_r1cs_constraints();
        validRate.generate_r1cs_constraints();

        isNonZeroFillAmountS.generate_r1cs_constraints();
        isNonZeroFillAmountB.generate_r1cs_constraints();
        fillsNonZero.generate_r1cs_constraints();
        isZeroFillAmountS.generate_r1cs_constraints();
        isZeroFillAmountB.generate_r1cs_constraints();
        fillsZero.generate_r1cs_constraints();
        fillsValid.generate_r1cs_constraints();
        requireFillsValid.generate_r1cs_constraints();
    }
};

// Check if an order is filled correctly
class RequireValidOrderGadget : public GadgetT
{
  public:
    RequireLtGadget requireValidUntil;

    RequireValidOrderGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &timestamp,
      const OrderGadget &order,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          requireValidUntil(
            pb,
            timestamp,
            order.validUntil.packed,
            NUM_BITS_TIMESTAMP,
            FMT(prefix, ".requireValidUntil"))
    {
    }

    void generate_r1cs_witness()
    {
        requireValidUntil.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        requireValidUntil.generate_r1cs_constraints();
    }
};

// Calculates the fees for an order
class FeeCalculatorGadget : public GadgetT
{
  public:
    MulDivGadget protocolFee;
    MulDivGadget fee;

    FeeCalculatorGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &amountB,
      const VariableT &protocolFeeBips,
      const VariableT &feeBips,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          protocolFee(
            pb,
            constants,
            amountB,
            protocolFeeBips,
            constants._100000,
            NUM_BITS_AMOUNT,
            NUM_BITS_PROTOCOL_FEE_BIPS,
            17 /*=ceil(log2(100000))*/,
            FMT(prefix, ".protocolFee")),
          fee(
            pb,
            constants,
            amountB,
            feeBips,
            constants._10000,
            NUM_BITS_AMOUNT,
            NUM_BITS_BIPS,
            14 /*=ceil(log2(10000))*/,
            FMT(prefix, ".fee"))
    {
    }

    void generate_r1cs_witness()
    {
        protocolFee.generate_r1cs_witness();
        fee.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        protocolFee.generate_r1cs_constraints();
        fee.generate_r1cs_constraints();
    }

    const VariableT &getProtocolFee() const
    {
        return protocolFee.result();
    }

    const VariableT &getFee() const
    {
        return fee.result();
    }
};

// Checks if the order isn't filled too much
class RequireFillLimitGadget : public GadgetT
{
  public:
    TernaryGadget fillAmount;
    TernaryGadget fillLimit;
    AddGadget filledAfter;
    RequireLeqGadget filledAfter_leq_fillLimit;

    RequireFillLimitGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const OrderGadget &order,
      const VariableT &filled,
      const VariableT &fillS,
      const VariableT &fillB,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          fillAmount(pb, order.fillAmountBorS.packed, fillB, fillS, FMT(prefix, ".fillAmount")),
          fillLimit(
            pb,
            order.fillAmountBorS.packed,
            order.amountB.packed,
            order.amountS.packed,
            FMT(prefix, ".fillLimit")),
          filledAfter(pb, filled, fillAmount.result(), NUM_BITS_AMOUNT, FMT(prefix, ".filledAfter")),
          filledAfter_leq_fillLimit(
            pb,
            filledAfter.result(),
            fillLimit.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".filledAfter_leq_fillLimit"))
    {
    }

    void generate_r1cs_witness()
    {
        fillAmount.generate_r1cs_witness();
        fillLimit.generate_r1cs_witness();
        filledAfter.generate_r1cs_witness();
        filledAfter_leq_fillLimit.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        fillAmount.generate_r1cs_constraints();
        fillLimit.generate_r1cs_constraints();
        filledAfter.generate_r1cs_constraints();
        filledAfter_leq_fillLimit.generate_r1cs_constraints();
    }

    const VariableT &getFilledAfter() const
    {
        return filledAfter.result();
    }
};

// Checks if the order requirements are fulfilled with the given fill amounts
class RequireOrderFillsGadget : public GadgetT
{
  public:
    // Check rate
    RequireFillRateGadget requireFillRate;
    // Check fill limit
    RequireFillLimitGadget requireFillLimit;

    RequireOrderFillsGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const OrderGadget &order,
      const VariableT &filled,
      const VariableT &fillS,
      const VariableT &fillB,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Check rate
          requireFillRate(
            pb,
            constants,
            order.amountS.packed,
            order.amountB.packed,
            fillS,
            fillB,
            NUM_BITS_AMOUNT,
            FMT(prefix, ".requireFillRate")),
          // Check fill limit
          requireFillLimit(pb, constants, order, filled, fillS, fillB, FMT(prefix, ".requireFillLimit"))
    {
    }

    void generate_r1cs_witness()
    {
        requireFillRate.generate_r1cs_witness();
        requireFillLimit.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        requireFillRate.generate_r1cs_constraints();
        requireFillLimit.generate_r1cs_constraints();
    }

    const VariableT &getFilledAfter() const
    {
        return requireFillLimit.getFilledAfter();
    }
};

// Checks if the order requirements are fulfilled with the given fill amounts
class RequireValidTakerGadget : public GadgetT
{
  public:
    EqualGadget takerMatches;
    EqualGadget takerOpen;
    OrGadget valid;
    RequireEqualGadget requireValid;

    RequireValidTakerGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &taker,
      const VariableT &expectedTaker,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          takerMatches(pb, taker, expectedTaker, FMT(prefix, ".takerMatches")),
          takerOpen(pb, constants._0, expectedTaker, FMT(prefix, ".takerOpen")),
          valid(pb, {takerMatches.result(), takerOpen.result()}, FMT(prefix, ".valid")),
          requireValid(pb, valid.result(), constants._1, FMT(prefix, ".requireValid"))
    {
    }

    void generate_r1cs_witness()
    {
        takerMatches.generate_r1cs_witness();
        takerOpen.generate_r1cs_witness();
        valid.generate_r1cs_witness();
        requireValid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        takerMatches.generate_r1cs_constraints();
        takerOpen.generate_r1cs_constraints();
        valid.generate_r1cs_constraints();
        requireValid.generate_r1cs_constraints();
    }
};

// Matches 2 orders
class OrderMatchingGadget : public GadgetT
{
  public:
    // Verify the order fills
    RequireOrderFillsGadget requireOrderFillsA;
    RequireOrderFillsGadget requireOrderFillsB;

    // Check if tokenS/tokenB match
    RequireEqualGadget orderA_tokenS_eq_orderB_tokenB;
    RequireEqualGadget orderA_tokenB_eq_orderB_tokenS;

    // Check if the takers match
    RequireValidTakerGadget validateTakerA;
    RequireValidTakerGadget validateTakerB;

    // Check if the orders are valid
    RequireValidOrderGadget requireValidA;
    RequireValidOrderGadget requireValidB;

    OrderMatchingGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &timestamp,
      const OrderGadget &orderA,
      const OrderGadget &orderB,
      const VariableT &ownerA,
      const VariableT &ownerB,
      const VariableT &filledA,
      const VariableT &filledB,
      const VariableT &fillS_A,
      const VariableT &fillS_B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Check if the fills are valid for the orders
          requireOrderFillsA(pb, constants, orderA, filledA, fillS_A, fillS_B, FMT(prefix, ".requireOrderFillsA")),
          requireOrderFillsB(pb, constants, orderB, filledB, fillS_B, fillS_A, FMT(prefix, ".requireOrderFillsB")),

          // Check if tokenS/tokenB match
          orderA_tokenS_eq_orderB_tokenB(
            pb,
            orderA.tokenS.packed,
            orderB.tokenB.packed,
            FMT(prefix, ".orderA_tokenS_eq_orderB_tokenB")),
          orderA_tokenB_eq_orderB_tokenS(
            pb,
            orderA.tokenB.packed,
            orderB.tokenS.packed,
            FMT(prefix, ".orderA_tokenB_eq_orderB_tokenS")),

          // Check if the takers match
          validateTakerA(pb, constants, ownerB, orderA.taker, FMT(prefix, ".validateTakerA")),
          validateTakerB(pb, constants, ownerA, orderB.taker, FMT(prefix, ".validateTakerB")),

          // Check if the orders in the settlement are correctly filled
          requireValidA(pb, constants, timestamp, orderA, FMT(prefix, ".checkValidA")),
          requireValidB(pb, constants, timestamp, orderB, FMT(prefix, ".checkValidB"))
    {
    }

    void generate_r1cs_witness()
    {
        // Check if the fills are valid for the orders
        requireOrderFillsA.generate_r1cs_witness();
        requireOrderFillsB.generate_r1cs_witness();

        // Check if tokenS/tokenB match
        orderA_tokenS_eq_orderB_tokenB.generate_r1cs_witness();
        orderA_tokenB_eq_orderB_tokenS.generate_r1cs_witness();

        // Check if the takers match
        validateTakerA.generate_r1cs_witness();
        validateTakerB.generate_r1cs_witness();

        // Check if the orders in the settlement are correctly filled
        requireValidA.generate_r1cs_witness();
        requireValidB.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Check if the fills are valid for the orders
        requireOrderFillsA.generate_r1cs_constraints();
        requireOrderFillsB.generate_r1cs_constraints();

        // Check if tokenS/tokenB match
        orderA_tokenS_eq_orderB_tokenB.generate_r1cs_constraints();
        orderA_tokenB_eq_orderB_tokenS.generate_r1cs_constraints();

        // Check if the takers match
        validateTakerA.generate_r1cs_constraints();
        validateTakerB.generate_r1cs_constraints();

        // Check if the orders in the settlement are correctly filled
        requireValidA.generate_r1cs_constraints();
        requireValidB.generate_r1cs_constraints();
    }

    const VariableT &getFilledAfter_A() const
    {
        return requireOrderFillsA.getFilledAfter();
    }

    const VariableT &getFilledAfter_B() const
    {
        return requireOrderFillsB.getFilledAfter();
    }
};

// const calcSpotPrice = (
//         balanceIn: number,
//         weightIn: number,
//         balanceOut: number,
//         weightOut: number) => {
//     const numer = balanceIn * weightOut;
//     const denom = balanceOut * weightIn;
//     const ratio = (numer * BASE_FIXED) / denom;
//     const invFeeBips = BASE_BIPS - feeBips;
//     return Math.floor((ratio * BASE_BIPS) / invFeeBips);
// }

// Result is guaranteed to fit inside NUM_BITS_AMOUNT*2 bits.
// Max ratio between weights guaranteed to be supported is 2**(96*2-14)/(10**18)
// but this depends on the balances inside the pool as well. Normally it should be even much higher.
class SpotPriceAMMGadget : public GadgetT
{
  public:
    UnsafeMulGadget numer;
    UnsafeMulGadget denom;
    MulDivGadget ratio;
    RangeCheckGadget ratioRangeCheck;
    UnsafeSubGadget invFeeBips;
    MulDivGadget res;

    SpotPriceAMMGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &balanceIn,
      const VariableT &weightIn,
      const VariableT &balanceOut,
      const VariableT &weightOut,
      const VariableT &feeBips,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          numer(pb, balanceIn, weightOut, FMT(prefix, ".numer")),
          denom(pb, balanceOut, weightIn, FMT(prefix, ".denom")),
          ratio(
            pb,
            constants,
            numer.result(),
            constants.fixedBase,
            denom.result(),
            NUM_BITS_AMOUNT * 2,
            60,
            NUM_BITS_AMOUNT * 2,
            FMT(prefix, ".ratio")),
          ratioRangeCheck(
            pb,
            ratio.result(),
            NUM_BITS_AMOUNT * 2 - 14 /*log2(10000)*/,
            FMT(prefix, ".ratioRangeCheck")),
          invFeeBips(pb, constants._10000, feeBips, FMT(prefix, ".invFeeBips")),
          res(
            pb,
            constants,
            ratio.result(),
            constants._10000,
            invFeeBips.result(),
            NUM_BITS_AMOUNT * 2 - 14,
            14 /*log2(10000)*/,
            14 /*log2(10000)*/,
            FMT(prefix, ".res"))
    {
    }

    void generate_r1cs_witness()
    {
        numer.generate_r1cs_witness();
        denom.generate_r1cs_witness();
        ratio.generate_r1cs_witness();
        ratioRangeCheck.generate_r1cs_witness();
        invFeeBips.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        numer.generate_r1cs_constraints();
        denom.generate_r1cs_constraints();
        ratio.generate_r1cs_constraints();
        ratioRangeCheck.generate_r1cs_constraints();
        invFeeBips.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return res.result();
    }
};

// const calcOutGivenIn = (
//       balanceIn: number,
//       weightIn: number,
//       balanceOut: number,
//       weightOut: number,
//       amountIn: number) => {
//   const weightRatio = (weightIn * BASE_FIXED) / weightOut;
//   const fee = amountIn * feeBips / BASE_BIPS;
//   const y = (balanceIn * BASE_FIXED) / (balanceIn + (amountIn - fee));
//   const p = pow_approx(y, weightRatio);
//   return Math.floor(balanceOut * (BASE_FIXED - p) / BASE_FIXED);
// }
class CalcOutGivenInAMMGadget : public GadgetT
{
  public:
    static const unsigned int numIterations = 4;

    MulDivGadget weightRatio;
    RangeCheckGadget weightRatioRangeCheck;
    MulDivGadget fee;
    UnsafeSubGadget amountInWithoutFee;
    AddGadget y_denom;
    MulDivGadget y;
    PowerGadget p;
    SubGadget invP;
    MulDivGadget res;

    CalcOutGivenInAMMGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &balanceIn,
      const VariableT &weightIn,
      const VariableT &balanceOut,
      const VariableT &weightOut,
      const VariableT &feeBips,
      const VariableT &amountIn,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          weightRatio(
            pb,
            constants,
            weightIn,
            constants.fixedBase,
            weightOut,
            NUM_BITS_AMOUNT,
            NUM_BITS_FIXED_BASE,
            NUM_BITS_AMOUNT,
            FMT(prefix, ".weightRatio")),
          weightRatioRangeCheck( //
            pb,
            weightRatio.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".weightRatioRangeCheck")),
          fee(
            pb,
            constants,
            amountIn,
            feeBips,
            constants._10000,
            NUM_BITS_AMOUNT,
            NUM_BITS_FIXED_BASE,
            14 /*log2(10000)*/,
            FMT(prefix, ".fee")),
          amountInWithoutFee( //
            pb,
            amountIn,
            fee.result(),
            FMT(prefix, ".amountInWithoutFee")),
          y_denom( //
            pb,
            balanceIn,
            amountInWithoutFee.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".y_denom")),
          y( //
            pb,
            constants,
            balanceIn,
            constants.fixedBase,
            y_denom.result(),
            NUM_BITS_AMOUNT,
            NUM_BITS_FIXED_BASE,
            NUM_BITS_AMOUNT,
            FMT(prefix, ".y")),
          p( //
            pb,
            constants,
            y.result(),
            weightRatio.result(),
            numIterations,
            FMT(prefix, ".p")),
          invP( //
            pb,
            constants.fixedBase,
            p.result(),
            NUM_BITS_FIXED_BASE,
            FMT(prefix, ".invP")),
          res(
            pb,
            constants,
            balanceOut,
            invP.result(),
            constants.fixedBase,
            NUM_BITS_AMOUNT,
            NUM_BITS_FIXED_BASE,
            NUM_BITS_FIXED_BASE,
            FMT(prefix, ".res"))
    {
    }

    void generate_r1cs_witness()
    {
        weightRatio.generate_r1cs_witness();
        weightRatioRangeCheck.generate_r1cs_witness();
        fee.generate_r1cs_witness();
        amountInWithoutFee.generate_r1cs_witness();
        y_denom.generate_r1cs_witness();
        y.generate_r1cs_witness();
        p.generate_r1cs_witness();
        invP.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        weightRatio.generate_r1cs_constraints();
        weightRatioRangeCheck.generate_r1cs_constraints();
        fee.generate_r1cs_constraints();
        amountInWithoutFee.generate_r1cs_constraints();
        y_denom.generate_r1cs_constraints();
        y.generate_r1cs_constraints();
        p.generate_r1cs_constraints();
        invP.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return res.result();
    }
};

struct OrderMatchingData
{
    const VariableT &amm;
    const VariableT &orderFeeBips;
    const VariableT &fillS;
    const VariableT &balanceBeforeS;
    const VariableT &balanceBeforeB;
    const VariableT &balanceAfterS;
    const VariableT &balanceAfterB;
    const VariableT &weightS;
    const VariableT &weightB;
    const VariableT &ammFeeBips;
};

// Checks if the order requirements are fulfilled with the given fill amounts
class RequireAMMFillsGadget : public GadgetT
{
  public:
    // Use dummy data if this isn't an AMM order
    TernaryGadget inBalanceBefore;
    TernaryGadget inBalanceAfter;
    TernaryGadget inWeight;
    TernaryGadget outBalanceBefore;
    TernaryGadget outBalanceAfter;
    TernaryGadget outWeight;
    TernaryGadget ammFill;

    // Verify general assumptions AMM orders
    IfThenRequireEqualGadget requireOrderFeeBipsZero;
    RequireNotZeroGadget requireInWeightNotZero;
    RequireNotZeroGadget requireOutWeightNotZero;

    // Calculate AMM minimum rate
    CalcOutGivenInAMMGadget ammMaximumFillS;
    LeqGadget fillS_leq_ammMaximumFillS;
    IfThenRequireGadget requireValidAmmFillS;

    // Check that the price increased as an additional safety check
    SpotPriceAMMGadget priceBefore;
    SpotPriceAMMGadget priceAfter;
    LeqGadget priceBefore_leq_priceAfter;
    IfThenRequireGadget requirePriceIncreased;

    RequireAMMFillsGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const OrderMatchingData &data,
      const VariableT &fillB,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Use dummy data if this isn't an AMM order
          inBalanceBefore( //
            pb,
            data.amm,
            data.balanceBeforeB,
            constants.fixedBase,
            FMT(prefix, ".inBalanceBefore")),
          inBalanceAfter( //
            pb,
            data.amm,
            data.balanceAfterB,
            constants.fixedBase,
            FMT(prefix, ".inBalanceAfter")),
          inWeight( //
            pb,
            data.amm,
            data.weightB,
            constants.fixedBase,
            FMT(prefix, ".inWeight")),
          outBalanceBefore( //
            pb,
            data.amm,
            data.balanceBeforeS,
            constants.fixedBase,
            FMT(prefix, ".outBalanceBefore")),
          outBalanceAfter( //
            pb,
            data.amm,
            data.balanceAfterS,
            constants.fixedBase,
            FMT(prefix, ".outBalanceAfter")),
          outWeight( //
            pb,
            data.amm,
            data.weightS,
            constants.fixedBase,
            FMT(prefix, ".outWeight")),
          ammFill( //
            pb,
            data.amm,
            fillB,
            constants._0,
            FMT(prefix, ".ammFill")),

          // Verify general assumptions AMM orders
          requireOrderFeeBipsZero(
            pb,
            data.amm,
            data.orderFeeBips,
            constants._0,
            FMT(prefix, ".requireOrderFeeBipsZero")),
          requireInWeightNotZero( //
            pb,
            inWeight.result(),
            FMT(prefix, ".requireInWeightNotZero")),
          requireOutWeightNotZero( //
            pb,
            outWeight.result(),
            FMT(prefix, ".requireOutWeightNotZero")),

          // Calculate AMM minimum rate
          ammMaximumFillS(
            pb,
            constants,
            inBalanceBefore.result(),
            inWeight.result(),
            outBalanceBefore.result(),
            outWeight.result(),
            data.ammFeeBips,
            ammFill.result(),
            FMT(prefix, ".ammMaximumFillS")),
          fillS_leq_ammMaximumFillS(
            pb,
            data.fillS,
            ammMaximumFillS.result(),
            NUM_BITS_AMOUNT,
            FMT(prefix, ".fillS_leq_ammMaximumFillS")),
          requireValidAmmFillS( //
            pb,
            data.amm,
            fillS_leq_ammMaximumFillS.leq(),
            FMT(prefix, ".requireValidAmmFillS")),

          // Check that the price increased as an additional safety check
          priceBefore(
            pb,
            constants,
            inBalanceBefore.result(),
            inWeight.result(),
            outBalanceBefore.result(),
            outWeight.result(),
            data.ammFeeBips,
            FMT(prefix, ".priceBefore")),
          priceAfter(
            pb,
            constants,
            inBalanceAfter.result(),
            inWeight.result(),
            outBalanceAfter.result(),
            outWeight.result(),
            data.ammFeeBips,
            FMT(prefix, ".priceBefore")),
          priceBefore_leq_priceAfter(
            pb,
            priceBefore.result(),
            priceAfter.result(),
            NUM_BITS_AMOUNT * 2,
            FMT(prefix, ".priceBefore_leq_priceAfter")),
          requirePriceIncreased( //
            pb,
            data.amm,
            priceBefore_leq_priceAfter.leq(),
            FMT(prefix, ".requirePriceIncreased"))
    {
    }

    void generate_r1cs_witness()
    {
        // Use dummy data if this isn't an AMM order
        inBalanceBefore.generate_r1cs_witness();
        inBalanceAfter.generate_r1cs_witness();
        inWeight.generate_r1cs_witness();
        outBalanceBefore.generate_r1cs_witness();
        outBalanceAfter.generate_r1cs_witness();
        outWeight.generate_r1cs_witness();
        ammFill.generate_r1cs_witness();

        // Verify general assumptions AMM orders
        requireOrderFeeBipsZero.generate_r1cs_witness();
        requireInWeightNotZero.generate_r1cs_witness();
        requireOutWeightNotZero.generate_r1cs_witness();

        // Calculate AMM minimum rate
        ammMaximumFillS.generate_r1cs_witness();
        fillS_leq_ammMaximumFillS.generate_r1cs_witness();
        requireValidAmmFillS.generate_r1cs_witness();

        // Check that the price increased as an additional safety check
        priceBefore.generate_r1cs_witness();
        priceAfter.generate_r1cs_witness();
        priceBefore_leq_priceAfter.generate_r1cs_witness();
        requirePriceIncreased.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Use dummy data if this isn't an AMM order
        inBalanceBefore.generate_r1cs_constraints();
        inBalanceAfter.generate_r1cs_constraints();
        inWeight.generate_r1cs_constraints();
        outBalanceBefore.generate_r1cs_constraints();
        outBalanceAfter.generate_r1cs_constraints();
        outWeight.generate_r1cs_constraints();
        ammFill.generate_r1cs_constraints();

        // Verify general assumptions AMM orders
        requireOrderFeeBipsZero.generate_r1cs_constraints();
        requireInWeightNotZero.generate_r1cs_constraints();
        requireOutWeightNotZero.generate_r1cs_constraints();

        // Calculate AMM minimum rate
        ammMaximumFillS.generate_r1cs_constraints();
        fillS_leq_ammMaximumFillS.generate_r1cs_constraints();
        requireValidAmmFillS.generate_r1cs_constraints();

        // Check that the price increased as an additional safety check
        priceBefore.generate_r1cs_constraints();
        priceAfter.generate_r1cs_constraints();
        priceBefore_leq_priceAfter.generate_r1cs_constraints();
        requirePriceIncreased.generate_r1cs_constraints();
    }
};

class ValidateAMMGadget : public GadgetT
{
  public:
    // Verify the order fills
    RequireAMMFillsGadget requireFillsA;
    RequireAMMFillsGadget requireFillsB;

    ValidateAMMGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const OrderMatchingData &dataA,
      const OrderMatchingData &dataB,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Check if the fills are valid for the orders
          requireFillsA(pb, constants, dataA, dataB.fillS, FMT(prefix, ".requireFillsA")),
          requireFillsB(pb, constants, dataB, dataA.fillS, FMT(prefix, ".requireFillsB"))
    {
    }

    void generate_r1cs_witness()
    {
        // Check if the fills are valid for the orders
        requireFillsA.generate_r1cs_witness();
        requireFillsB.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Check if the fills are valid for the orders
        requireFillsA.generate_r1cs_constraints();
        requireFillsB.generate_r1cs_constraints();
    }
};

} // namespace Loopring

#endif
