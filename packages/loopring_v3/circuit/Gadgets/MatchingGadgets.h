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
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& amountS,
        const VariableT& amountB,
        const VariableT& fillAmountS,
        const VariableT& fillAmountB,
        unsigned int n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        fillAmountS_mul_amountB(pb, fillAmountS, amountB, FMT(prefix, ".fillAmountS_mul_amountB")),
        fillAmountS_mul_amountB_mul_1000(pb, fillAmountS_mul_amountB.result(), constants._1000, FMT(prefix, ".fillAmountS_mul_amountB_mul_1000")),
        fillAmountB_mul_amountS(pb, fillAmountB, amountS, FMT(prefix, ".fillAmountB_mul_amountS")),
        fillAmountB_mul_amountS_mul_1001(pb, fillAmountB_mul_amountS.result(), constants._1001, FMT(prefix, ".fillAmountB_mul_amountS_mul_1001")),
        validRate(pb, fillAmountS_mul_amountB_mul_1000.result(), fillAmountB_mul_amountS_mul_1001.result(), n * 2 + 10 /*=ceil(log2(1000))*/, FMT(prefix, ".validRate")),

        // Also enforce that either both fill amounts are zero or both are non-zero.
        // This check is also important to make sure no token transfers can happen to unregistered token IDs.
        isNonZeroFillAmountS(pb, fillAmountS, FMT(prefix, "isNonZeroFillAmountS")),
        isNonZeroFillAmountB(pb, fillAmountB, FMT(prefix, "isNonZeroFillAmountB")),
        fillsNonZero(pb, {isNonZeroFillAmountS.result(), isNonZeroFillAmountB.result()}, FMT(prefix, "fillsNonZero")),
        isZeroFillAmountS(pb, isNonZeroFillAmountS.result(), FMT(prefix, "isZeroFillAmountS")),
        isZeroFillAmountB(pb, isNonZeroFillAmountB.result(), FMT(prefix, "isZeroFillAmountB")),
        fillsZero(pb, {isZeroFillAmountS.result(), isZeroFillAmountB.result()}, FMT(prefix, "fillsZero")),
        fillsValid(pb, {fillsNonZero.result(), fillsZero.result()}, FMT(prefix, "fillsValid")),
        requireFillsValid(pb, fillsValid.result(), constants.one, FMT(prefix, "requireFillsValid"))
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
class CheckValidGadget : public GadgetT
{
public:

    LeqGadget fillAmountS_lt_amountS;
    LeqGadget fillAmountB_lt_amountB;
    NotGadget order_sell;
    AndGadget notValidAllOrNoneSell;
    AndGadget notValidAllOrNoneBuy;

    LeqGadget validSince_leq_timestamp;
    LeqGadget timestamp_leq_validUntil;

    NotGadget validAllOrNoneSell;
    NotGadget validAllOrNoneBuy;

    AndGadget valid;

    CheckValidGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& timestamp,
        const OrderGadget& order,
        const VariableT& fillAmountS,
        const VariableT& fillAmountB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        // This can be combined in a single comparison (buy/sell order)
        fillAmountS_lt_amountS(pb, fillAmountS, order.amountS.packed, NUM_BITS_AMOUNT, FMT(prefix, ".fillAmountS_lt_amountS")),
        fillAmountB_lt_amountB(pb, fillAmountB, order.amountB.packed, NUM_BITS_AMOUNT, FMT(prefix, ".fillAmountB_lt_amountB")),
        order_sell(pb, order.buy.packed, FMT(prefix, ".order_sell")),
        notValidAllOrNoneSell(pb, { order.allOrNone.packed, order_sell.result(), fillAmountS_lt_amountS.lt() }, FMT(prefix, ".notValidAllOrNoneSell")),
        notValidAllOrNoneBuy(pb, { order.allOrNone.packed, order.buy.packed, fillAmountB_lt_amountB.lt() }, FMT(prefix, ".notValidAllOrNoneBuy")),

        validSince_leq_timestamp(pb, order.validSince.packed, timestamp, NUM_BITS_TIMESTAMP, FMT(prefix, "validSince <= timestamp")),
        timestamp_leq_validUntil(pb, timestamp, order.validUntil.packed, NUM_BITS_TIMESTAMP, FMT(prefix, "timestamp <= validUntil")),

        validAllOrNoneSell(pb, notValidAllOrNoneSell.result(), FMT(prefix, "validAllOrNoneSell")),
        validAllOrNoneBuy(pb, notValidAllOrNoneBuy.result(), FMT(prefix, "validAllOrNoneBuy")),

        valid(pb,
                {
                    validSince_leq_timestamp.leq(),
                    timestamp_leq_validUntil.leq(),
                    validAllOrNoneSell.result(),
                    validAllOrNoneBuy.result()
                },
                FMT(prefix, ".valid")
            )
    {

    }

    void generate_r1cs_witness ()
    {
        fillAmountS_lt_amountS.generate_r1cs_witness();
        fillAmountB_lt_amountB.generate_r1cs_witness();
        order_sell.generate_r1cs_witness();
        notValidAllOrNoneSell.generate_r1cs_witness();
        notValidAllOrNoneBuy.generate_r1cs_witness();

        validSince_leq_timestamp.generate_r1cs_witness();
        timestamp_leq_validUntil.generate_r1cs_witness();

        validAllOrNoneSell.generate_r1cs_witness();
        validAllOrNoneBuy.generate_r1cs_witness();

        valid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        fillAmountS_lt_amountS.generate_r1cs_constraints();
        fillAmountB_lt_amountB.generate_r1cs_constraints();
        order_sell.generate_r1cs_constraints();
        notValidAllOrNoneSell.generate_r1cs_constraints();
        notValidAllOrNoneBuy.generate_r1cs_constraints();

        validSince_leq_timestamp.generate_r1cs_constraints();
        timestamp_leq_validUntil.generate_r1cs_constraints();

        validAllOrNoneSell.generate_r1cs_constraints();
        validAllOrNoneBuy.generate_r1cs_constraints();

        valid.generate_r1cs_constraints();
    }

    const VariableT& isValid() const
    {
        return valid.result();
    }
};

// Calculates the fees for an order
class FeeCalculatorGadget : public GadgetT
{
public:

    // We could combine the fee and rebate calculations here, saving a MulDiv, but the MulDiv is cheap here,
    // so let's keep things simple.
    MulDivGadget protocolFee;
    MulDivGadget fee;
    MulDivGadget rebate;

    FeeCalculatorGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& amountB,
        const VariableT& protocolFeeBips,
        const VariableT& feeBips,
        const VariableT& rebateBips,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        protocolFee(pb, constants, amountB, protocolFeeBips, constants._100000, NUM_BITS_AMOUNT, NUM_BITS_PROTOCOL_FEE_BIPS, 17 /*=ceil(log2(100000))*/, FMT(prefix, ".protocolFee")),
        fee(pb, constants, amountB, feeBips, constants._10000, NUM_BITS_AMOUNT, NUM_BITS_BIPS, 14 /*=ceil(log2(10000))*/, FMT(prefix, ".fee")),
        rebate(pb, constants, amountB, rebateBips, constants._10000, NUM_BITS_AMOUNT, NUM_BITS_BIPS, 14 /*=ceil(log2(10000))*/, FMT(prefix, ".rebate"))
    {

    }

    void generate_r1cs_witness()
    {
        protocolFee.generate_r1cs_witness();
        fee.generate_r1cs_witness();
        rebate.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        protocolFee.generate_r1cs_constraints();
        fee.generate_r1cs_constraints();
        rebate.generate_r1cs_constraints();
    }

    const VariableT& getProtocolFee() const
    {
        return protocolFee.result();
    }

    const VariableT& getFee() const
    {
        return fee.result();
    }

    const VariableT& getRebate() const
    {
        return rebate.result();
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
        ProtoboardT& pb,
        const Constants& constants,
        const OrderGadget& order,
        const VariableT& fillS,
        const VariableT& fillB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        fillAmount(pb, order.buy.packed, fillB, fillS, FMT(prefix, ".fillAmount")),
        fillLimit(pb, order.buy.packed, order.amountB.packed, order.amountS.packed, FMT(prefix, ".fillLimit")),
        filledAfter(pb, order.tradeHistory.getFilled(), fillAmount.result(), NUM_BITS_AMOUNT, FMT(prefix, ".filledAfter")),
        filledAfter_leq_fillLimit(pb, filledAfter.result(), fillLimit.result(), NUM_BITS_AMOUNT, FMT(prefix, ".filledAfter_leq_fillLimit"))
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

    const VariableT& getFilledAfter() const
    {
        return filledAfter.result();
    }
};

// Checks if the order requirements are fulfilled with the given fill amounts
class RequireOrderFillsGadget : public GadgetT
{
public:
    // Check balance limit
    RequireLeqGadget fillS_leq_balanceS;
    // Check rate
    RequireFillRateGadget requireFillRate;
    // Check fill limit
    RequireFillLimitGadget requireFillLimit;

    RequireOrderFillsGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const OrderGadget& order,
        const VariableT& fillS,
        const VariableT& fillB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        // Check balance
        fillS_leq_balanceS(pb, fillS, order.balanceSBefore.balance, NUM_BITS_AMOUNT, FMT(prefix, ".fillS_leq_balanceS")),
        // Check rate
        requireFillRate(pb, constants, order.amountS.packed, order.amountB.packed, fillS, fillB, NUM_BITS_AMOUNT, FMT(prefix, ".requireFillRate")),
        // Check fill limit
        requireFillLimit(pb, constants, order, fillS, fillB,  FMT(prefix, ".requireFillLimit"))
    {

    }

    void generate_r1cs_witness()
    {
        fillS_leq_balanceS.generate_r1cs_witness();
        requireFillRate.generate_r1cs_witness();
        requireFillLimit.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        fillS_leq_balanceS.generate_r1cs_constraints();
        requireFillRate.generate_r1cs_constraints();
        requireFillLimit.generate_r1cs_constraints();
    }

    const VariableT& getFilledAfter() const
    {
        return requireFillLimit.getFilledAfter();
    }
};

// Matches 2 orders
class OrderMatchingGadget : public GadgetT
{
public:

    const VariableT& fillS_A;
    const VariableT& fillS_B;

    // Verify the order fills
    RequireOrderFillsGadget requireOrderFillsA;
    RequireOrderFillsGadget requireOrderFillsB;

    // Check if tokenS/tokenB match
    RequireEqualGadget orderA_tokenS_eq_orderB_tokenB;
    RequireEqualGadget orderA_tokenB_eq_orderB_tokenS;

    // Check if the orders in the settlement are correctly filled
    CheckValidGadget checkValidA;
    CheckValidGadget checkValidB;
    AndGadget valid;
    RequireEqualGadget requireValid;

    OrderMatchingGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& timestamp,
        const OrderGadget& orderA,
        const OrderGadget& orderB,
        const VariableT& _fillS_A,
        const VariableT& _fillS_B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        fillS_A(_fillS_A),
        fillS_B(_fillS_B),

        // Check if the fills are valid for the orders
        requireOrderFillsA(pb, constants, orderA, fillS_A, fillS_B, FMT(prefix, ".requireOrderFillsA")),
        requireOrderFillsB(pb, constants, orderB, fillS_B, fillS_A, FMT(prefix, ".requireOrderFillsB")),

        // Check if tokenS/tokenB match
        orderA_tokenS_eq_orderB_tokenB(pb, orderA.tokenS.packed, orderB.tokenB.packed, FMT(prefix, ".orderA_tokenS_eq_orderB_tokenB")),
        orderA_tokenB_eq_orderB_tokenS(pb, orderA.tokenB.packed, orderB.tokenS.packed, FMT(prefix, ".orderA_tokenB_eq_orderB_tokenS")),

        // Check if the orders in the settlement are correctly filled
        checkValidA(pb, constants, timestamp, orderA, fillS_A, fillS_B, FMT(prefix, ".checkValidA")),
        checkValidB(pb, constants, timestamp, orderB, fillS_B, fillS_A, FMT(prefix, ".checkValidB")),
        valid(pb, {checkValidA.isValid(), checkValidB.isValid()}, FMT(prefix, ".valid")),
        requireValid(pb, valid.result(), constants.one, FMT(prefix, ".requireValid"))
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

        // Check if the orders in the settlement are correctly filled
        checkValidA.generate_r1cs_witness();
        checkValidB.generate_r1cs_witness();
        valid.generate_r1cs_witness();
        requireValid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Check if the fills are valid for the orders
        requireOrderFillsA.generate_r1cs_constraints();
        requireOrderFillsB.generate_r1cs_constraints();

        // Check if tokenS/tokenB match
        orderA_tokenS_eq_orderB_tokenB.generate_r1cs_constraints();
        orderA_tokenB_eq_orderB_tokenS.generate_r1cs_constraints();

        // Check if the orders in the settlement are correctly filled
        checkValidA.generate_r1cs_constraints();
        checkValidB.generate_r1cs_constraints();
        valid.generate_r1cs_constraints();
        requireValid.generate_r1cs_constraints();
    }

    const VariableT& getFilledAfter_A() const
    {
        return requireOrderFillsA.getFilledAfter();
    }

    const VariableT& getFilledAfter_B() const
    {
        return requireOrderFillsB.getFilledAfter();
    }
};


}

#endif
