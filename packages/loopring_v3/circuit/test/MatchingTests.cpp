#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/MatchingGadgets.h"

struct OrderState
{
    Order order;
    Account account;
    BalanceLeaf balanceLeafS;
    BalanceLeaf balanceLeafB;
    TradeHistoryLeaf tradeHistoryLeaf;
};

OrderState setOrderState(const OrderState& orderState,
                         const FieldT& orderID,
                         const FieldT& amountS, const FieldT& amountB, bool buy,
                         const FieldT& balanceS,
                         const FieldT& filled, const FieldT& tradeHistoryOrderID,
                         bool allOrNone = false)
{
    OrderState newOrderState(orderState);
    newOrderState.order.orderID = orderID;
    newOrderState.order.amountS = amountS;
    newOrderState.order.amountB = amountB;
    newOrderState.order.buy = buy ? 1 : 0;
    newOrderState.order.allOrNone = allOrNone ? 1 : 0;
    newOrderState.balanceLeafS.balance = balanceS;
    newOrderState.balanceLeafB.balance = 0;
    newOrderState.tradeHistoryLeaf.filled = filled;
    newOrderState.tradeHistoryLeaf.orderID = tradeHistoryOrderID;
    return newOrderState;
};

bool lt(const FieldT& A, const FieldT& B)
{
    return toBigInt(A) < toBigInt(B);
}

bool lte(const FieldT& A, const FieldT& B)
{
    return toBigInt(A) <= toBigInt(B);
}

FieldT muldiv(const FieldT& V, const FieldT& N, const FieldT& D)
{
    return toFieldElement(validate(toBigInt(V) * toBigInt(N)) / toBigInt(D));
}

TEST_CASE("RequireFillRate", "[RequireFillRateGadget]")
{
    unsigned int maxLength = NUM_BITS_AMOUNT;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        enum class Expected
        {
            Valid,
            Invalid,
            Automatic
        };
        auto checkFillRateChecked = [n](const BigInt& _amountS, const BigInt& _amountB,
                                        const BigInt& _fillAmountS, const BigInt& _fillAmountB,
                                        Expected expected = Expected::Automatic)
        {
            protoboard<FieldT> pb;

            VariableT amountS = make_variable(pb, toFieldElement(_amountS), "amountS");
            VariableT amountB = make_variable(pb, toFieldElement(_amountB), "amountB");
            VariableT fillAmountS = make_variable(pb, toFieldElement(_fillAmountS), "fillAmountS");
            VariableT fillAmountB = make_variable(pb, toFieldElement(_fillAmountB), "fillAmountB");

            Constants constants(pb, "constants");
            RequireFillRateGadget requireFillRateGadget(pb, constants, amountS, amountB, fillAmountS, fillAmountB, n, "requireFillRateGadget");
            requireFillRateGadget.generate_r1cs_constraints();
            requireFillRateGadget.generate_r1cs_witness();

            bool expectedAutomaticValid = (_fillAmountS * _amountB * 1000) <= (_fillAmountB * _amountS * 1001);
            expectedAutomaticValid = expectedAutomaticValid && ((_fillAmountS == 0 && _fillAmountB == 0) || (_fillAmountS != 0 && _fillAmountB != 0));

            bool expectedValid = false;
            if (expected == Expected::Automatic)
            {
                expectedValid = expectedAutomaticValid;
            }
            else
            {
                expectedValid = (expected == Expected::Valid) ? true : false;
            }
            REQUIRE(expectedAutomaticValid == expectedValid);

            REQUIRE(pb.is_satisfied() == expectedValid);
        };

        BigInt max = getMaxFieldElementAsBigInt(n);

        SECTION("order: 1/1, fill: 1/1")
        {
            checkFillRateChecked(1, 1, 1, 1, Expected::Valid);
        }

        SECTION("order: 1/1, fill: 0/0")
        {
            checkFillRateChecked(1, 1, 0, 0, Expected::Valid);
        }

        SECTION("order: 1/1, fill: 1/0")
        {
            checkFillRateChecked(1, 1, 1, 0, Expected::Invalid);
        }

        SECTION("order: 1/1, fill: 0/1")
        {
            checkFillRateChecked(1, 1, 0, 1, Expected::Invalid);
        }

        SECTION("order: max/max, fill: max/max")
        {
            checkFillRateChecked(max, max, max, max, Expected::Valid);
        }

        SECTION("order: 1/1, fill: max/max")
        {
            checkFillRateChecked(1, 1, max, max, Expected::Valid);
        }

        SECTION("order: max/max, fill: 1/1")
        {
            checkFillRateChecked(max, max, 1, 1, Expected::Valid);
        }

        SECTION("order: max/max, fill: 0/0")
        {
            checkFillRateChecked(max, max, 0, 0, Expected::Valid);
        }

        SECTION("order: max/max, fill: 1/0")
        {
            checkFillRateChecked(max, max, 1, 0, Expected::Invalid);
        }

        SECTION("order: max/max, fill: 0/1")
        {
            checkFillRateChecked(max, max, 0, 1, Expected::Invalid);
        }

        SECTION("order: max/max, fill: max/0")
        {
            checkFillRateChecked(max, max, max, 0, Expected::Invalid);
        }

        SECTION("order: max/max, fill: 0/max")
        {
            checkFillRateChecked(max, max, 0, max, Expected::Invalid);
        }

        SECTION("order: max/1, fill: max/1")
        {
            checkFillRateChecked(max, 1, max, 1, Expected::Valid);
        }

        SECTION("order: 1/max, fill: 1/max")
        {
            checkFillRateChecked(1, max, 1, max, Expected::Valid);
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                checkFillRateChecked(getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n),
                                     getRandomFieldElementAsBigInt(n), getRandomFieldElementAsBigInt(n));
            }
        }

        // Do some specific tests
        if (n == NUM_BITS_AMOUNT)
        {
            SECTION("order: 20000/2000, fill: 10000/1000")
            {
                checkFillRateChecked(20000, 2000, 10000, 1000, Expected::Valid);
            }

            SECTION("order: 20000/2000, fill: 9000/1000")
            {
                checkFillRateChecked(20000, 2000, 9000, 1000, Expected::Valid);
            }

            SECTION("order: 20000/2000, fill: 10000/1100")
            {
                checkFillRateChecked(20000, 2000, 10000, 1100, Expected::Valid);
            }

            SECTION("Exhaustive checks against a single value")
            {
                unsigned int targetFillS = 10000;
                unsigned int targetFillB = 1000;

                // Change fillAmountS
                for(unsigned int fillS = 0; fillS < targetFillS * 2; fillS++)
                {
                    bool expectedValid = fillS <= targetFillS + targetFillS / 1000 && fillS > 0;
                    checkFillRateChecked(20000, 2000, fillS, targetFillB, expectedValid ? Expected::Valid : Expected::Invalid);
                }

                // Change fillAmountB
                for(unsigned int fillB = 0; fillB < targetFillB * 2; fillB++)
                {
                    bool expectedValid = fillB > targetFillB - targetFillB / 1000 && fillB > 0;
                    checkFillRateChecked(20000, 2000, targetFillS, fillB, expectedValid ? Expected::Valid : Expected::Invalid);
                }
            }
        }
    }}
}

TEST_CASE("RequireFillLimit", "[RequireFillLimitGadget]")
{
    unsigned int numIterations = 1024;

    Block block = getBlock();
    const UniversalTransaction& tx = getSpotTrade(block);

    const Order& order = tx.spotTrade.orderA;
    const Account& account = tx.witness.accountUpdate_A.before;
    const BalanceLeaf& balanceLeafS = tx.witness.balanceUpdateS_A.before;
    const BalanceLeaf& balanceLeafB = tx.witness.balanceUpdateB_A.before;
    const TradeHistoryLeaf& tradeHistoryLeaf = tx.witness.tradeHistoryUpdate_A.before;
    const OrderState _orderState = {order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf};

    unsigned int numTradeHistoryLeafs = pow(2, NUM_BITS_TRADING_HISTORY);
    const FieldT orderID = rand() % numTradeHistoryLeafs;

    enum class Expected
    {
        Valid,
        Invalid,
        Automatic
    };
    auto checkFillLimitChecked = [_orderState](const FieldT& _amountS, const FieldT& _amountB, bool _buy, unsigned int _orderID,
                                               unsigned int  _tradeHistoryOrderID, const FieldT& _filled,
                                               const FieldT& _fillAmountS, const FieldT& _fillAmountB,
                                               Expected expected = Expected::Automatic)
    {
        protoboard<FieldT> pb;

        OrderState orderState = setOrderState(
            _orderState,
            _orderID,
            _amountS, _amountB, _buy,
            getMaxFieldElement(NUM_BITS_AMOUNT),
            _filled, _tradeHistoryOrderID
        );

        VariableT fillAmountS = make_variable(pb, _fillAmountS, "fillAmountS");
        VariableT fillAmountB = make_variable(pb, _fillAmountB, "fillAmountB");

        Constants constants(pb, "constants");

        VariableT exchange = make_variable(pb, 0, "exchange");
        VariableT timestamp = make_variable(pb, 0, "timestamp");

        OrderGadget order(pb, constants, exchange, ".order");
        order.generate_r1cs_witness(orderState.order);

        TradeHistoryGadget tradeHistoryData(pb, ".tradeHistory");
        tradeHistoryData.generate_r1cs_witness(orderState.tradeHistoryLeaf);

        TradeHistoryTrimmingGadget tradeHistory(pb, constants, tradeHistoryData, order.orderID, ".tradeHistoryTrimmingGadget");
        tradeHistory.generate_r1cs_witness();

        RequireFillLimitGadget requireFillLimit(pb, constants, order, tradeHistory.getFilled(), fillAmountS, fillAmountB, "requireFillRateGadget");
        requireFillLimit.generate_r1cs_constraints();
        requireFillLimit.generate_r1cs_witness();

        // Simulate
        FieldT limit;
        FieldT filledAfter;
        if (_buy)
        {
            limit = _amountB;
            filledAfter = pb.val(tradeHistory.getFilled()) + _fillAmountB;
        }
        else
        {
            limit = _amountS;
            filledAfter = pb.val(tradeHistory.getFilled()) + _fillAmountS;
        }
        bool expectedAutomaticValid = lte(filledAfter, limit);

        bool expectedValid = false;
        if (expected == Expected::Automatic)
        {
            expectedValid = expectedAutomaticValid;
        }
        else
        {
            expectedValid = (expected == Expected::Valid) ? true : false;
        }
        REQUIRE(expectedAutomaticValid == expectedValid);

        REQUIRE(pb.is_satisfied() == expectedValid);
        if (expectedValid)
        {
            REQUIRE((pb.val(requireFillLimit.getFilledAfter()) == filledAfter));
        }
    };

    unsigned int n = NUM_BITS_AMOUNT;
    FieldT maxAmount = getMaxFieldElement(NUM_BITS_AMOUNT);

    SECTION("order: 1/1, fill: 1/1")
    {
        checkFillLimitChecked(1, 1, true, 0,
                              0, 0,
                              1, 1, Expected::Valid);
    }

    SECTION("order: max/max, fill: max/max")
    {
        checkFillLimitChecked(maxAmount, maxAmount, true, 0,
                              0, 0,
                              1, 1, Expected::Valid);
    }

    SECTION("order: 1/1, fill: max/max")
    {
        checkFillLimitChecked(1, 1, true, 0,
                              0, 0,
                              maxAmount, maxAmount, Expected::Invalid);
    }

    SECTION("order: max/max, fill: 1/1")
    {
        checkFillLimitChecked(maxAmount, maxAmount, true, 0,
                              0, 0,
                              1, 1, Expected::Valid);
    }

    SECTION("order: max/1, fill: max/1")
    {
        checkFillLimitChecked(maxAmount, 1, true, 0,
                              0, 0,
                              maxAmount, 1, Expected::Valid);
    }

    SECTION("order: 1/max, fill: 1/max")
    {
        checkFillLimitChecked(1, maxAmount, true, 0,
                              0, 0,
                              1, maxAmount, Expected::Valid);
    }

    SECTION("reuse slot")
    {
        unsigned int orderID = rand() % NUM_BITS_TRADING_HISTORY;
        checkFillLimitChecked(2, 2, true, orderID,
                              orderID, 1,
                              1, 1, Expected::Valid);
    }

    SECTION("overwrite slot")
    {
        unsigned int orderID = rand() % NUM_BITS_TRADING_HISTORY;
        checkFillLimitChecked(maxAmount, maxAmount, true, orderID + numTradeHistoryLeafs,
                              orderID, maxAmount,
                              maxAmount, maxAmount, Expected::Valid);
    }

    SECTION("Fill limits")
    {
        unsigned int orderID = rand() % NUM_BITS_TRADING_HISTORY;
        unsigned int amountS = 1000;
        unsigned int amountB = 100;

        // buy order
        for(unsigned int filled = 0; filled < amountB * 2; filled += 10)
        {
            for(unsigned int fillB = 0; fillB < amountB * 2; fillB += 10)
            {
                bool expectedValid = (filled + fillB <= amountB);
                checkFillLimitChecked(amountS, amountB, true, orderID,
                                      orderID, filled,
                                      fillB * 9, fillB,
                                      expectedValid ? Expected::Valid : Expected::Invalid);
            }
        }

        // sell order
        for(unsigned int filled = 0; filled < amountS * 2; filled += 100)
        {
            for(unsigned int fillS = 0; fillS < amountS * 2; fillS += 100)
            {
                bool expectedValid = (filled + fillS <= amountS);
                checkFillLimitChecked(amountS, amountB, false, orderID,
                                      orderID, filled,
                                      fillS, fillS / 9,
                                      expectedValid ? Expected::Valid : Expected::Invalid);
            }
        }
    }

    SECTION("Random")
    {
        for (unsigned int i = 0; i < numIterations; i++)
        {
            bool buy = i % 2;
            unsigned int tradeHistoryOrderID = rand() % (1 << 30);
            unsigned int orderID = (rand() % 2) == 0 ? tradeHistoryOrderID : tradeHistoryOrderID + MAX_CONCURRENT_ORDERIDS;
            checkFillLimitChecked(getRandomFieldElement(n), getRandomFieldElement(n), buy, orderID,
                                  tradeHistoryOrderID, getRandomFieldElement(n),
                                  getRandomFieldElement(n), getRandomFieldElement(n));
        }
    }
}

TEST_CASE("FeeCalculator", "[FeeCalculatorGadget]")
{
    unsigned int maxLength = NUM_BITS_AMOUNT;
    unsigned int numIterations = 8;

    auto feeCalculatorChecked = [](const BigInt& _fillB,
                                   unsigned int _protocolFeeBips,
                                   unsigned int _feeBips,
                                   unsigned int _rebateBips)
    {
        protoboard<FieldT> pb;

        VariableT fillB = make_variable(pb, toFieldElement(_fillB), "fillB");
        VariableT protocolFeeBips = make_variable(pb, toFieldElement(_protocolFeeBips), "protocolFeeBips");
        VariableT feeBips = make_variable(pb, toFieldElement(_feeBips), "feeBips");
        VariableT rebateBips = make_variable(pb, toFieldElement(_rebateBips), "rebateBips");

        Constants constants(pb, "constants");
        FeeCalculatorGadget feeCalculatorGadget(pb, constants, fillB, protocolFeeBips, feeBips, rebateBips, "feeCalculatorGadget");
        feeCalculatorGadget.generate_r1cs_constraints();
        feeCalculatorGadget.generate_r1cs_witness();

        FieldT expectedProtocolFee = toFieldElement(_fillB * _protocolFeeBips / 100000);
        FieldT expectedFee = toFieldElement(_fillB * _feeBips / 10000);
        FieldT expectedRebate = toFieldElement(_fillB * _rebateBips / 10000);

        REQUIRE(pb.is_satisfied());
        REQUIRE((pb.val(feeCalculatorGadget.getProtocolFee()) == expectedProtocolFee));
        REQUIRE((pb.val(feeCalculatorGadget.getFee()) == expectedFee));
        REQUIRE((pb.val(feeCalculatorGadget.getRebate()) == expectedRebate));
    };

    BigInt maxAmount = getMaxFieldElementAsBigInt(NUM_BITS_AMOUNT);

    SECTION("Protocol fee")
    {
        for (unsigned int i = 0; i < pow(2, NUM_BITS_PROTOCOL_FEE_BIPS); i++)
        {
            feeCalculatorChecked(0, i, 0, 0);
        }

        for (unsigned int i = 0; i < pow(2, NUM_BITS_PROTOCOL_FEE_BIPS); i++)
        {
            feeCalculatorChecked(maxAmount, i, 0, 0);
        }
    }

    SECTION("Fee")
    {
        for (unsigned int i = 0; i < pow(2, NUM_BITS_BIPS); i++)
        {
            feeCalculatorChecked(0, 0, i, 0);
        }

        for (unsigned int i = 0; i < pow(2, NUM_BITS_BIPS); i++)
        {
            feeCalculatorChecked(maxAmount, 0, i, 0);
        }
    }

    SECTION("Rebate")
    {
        for (unsigned int i = 0; i < pow(2, NUM_BITS_BIPS); i++)
        {
            feeCalculatorChecked(0, 0, 0, i);
        }

        for (unsigned int i = 0; i < pow(2, NUM_BITS_BIPS); i++)
        {
            feeCalculatorChecked(maxAmount, 0, 0, i);
        }
    }

    SECTION("Random")
    {
        unsigned int numIterations = 1024;
        for (unsigned int i = 0; i < numIterations; i++)
        {
            BigInt fillB = getRandomFieldElementAsBigInt(NUM_BITS_AMOUNT);
            unsigned int protocolFeeBips = rand() % int(pow(2, NUM_BITS_PROTOCOL_FEE_BIPS));
            unsigned int feeBips = rand() % int(pow(2, NUM_BITS_BIPS));
            unsigned int rebateBips = rand() % int(pow(2, NUM_BITS_BIPS));
            feeCalculatorChecked(fillB, protocolFeeBips, feeBips, rebateBips);
        }
    }
}


namespace Simulator
{
    struct Fill
    {
        FieldT S;
        FieldT B;
    };

    struct TradeHistory
    {
        FieldT filled;
    };

    struct Settlement
    {
        FieldT fillS_A;
        FieldT fillS_B;
        bool valid;
    };

    TradeHistory getTradeHistory(const OrderState& orderState)
    {
        FieldT filled = lt(orderState.tradeHistoryLeaf.orderID, orderState.order.orderID) ? 0 : orderState.tradeHistoryLeaf.filled;
        return {filled};
    }

    Fill getMaxFillAmounts(const OrderState& orderState)
    {
        TradeHistory tradeHistory = getTradeHistory(orderState);
        FieldT remainingS = 0;
        if (orderState.order.buy == FieldT::one())
        {
            FieldT filled = lt(orderState.order.amountB, tradeHistory.filled) ? orderState.order.amountB : tradeHistory.filled;
            FieldT remainingB = orderState.order.amountB - filled;
            remainingS = muldiv(remainingB, orderState.order.amountS, orderState.order.amountB);
        }
        else
        {
            FieldT filled = lt(orderState.order.amountS, tradeHistory.filled) ? orderState.order.amountS : tradeHistory.filled;
            remainingS = orderState.order.amountS - filled;
        }
        FieldT fillAmountS = lt(orderState.balanceLeafS.balance, remainingS) ? orderState.balanceLeafS.balance : remainingS;
        FieldT fillAmountB = muldiv(fillAmountS, orderState.order.amountB, orderState.order.amountS);
        return {fillAmountS, fillAmountB};
    }

    bool match(const Order& takerOrder, Fill& takerFill, const Order& makerOrder, Fill& makerFill)
    {
        if (lt(takerFill.B, makerFill.S))
        {
            makerFill.S = takerFill.B;
            makerFill.B = muldiv(makerFill.S, makerOrder.amountB, makerOrder.amountS);
        }
        else
        {
            takerFill.B = makerFill.S;
            takerFill.S = muldiv(takerFill.B, takerOrder.amountS, takerOrder.amountB);
        }

        bool matchable = lte(makerFill.B, takerFill.S);
        return matchable;
    }

    bool checkFillRate(const FieldT& amountS, const FieldT& amountB, const FieldT& fillAmountS, const FieldT& fillAmountB)
    {
        return lte(fillAmountS * amountB * FieldT(1000), fillAmountB * amountS * FieldT(1001));
    }

    bool checkValid(const Order& order, const FieldT& fillAmountS, const FieldT& fillAmountB, const FieldT& timestamp)
    {
        bool valid = true;
        valid = valid && lte(order.validSince, timestamp);
        valid = valid && lte(timestamp, order.validUntil);
        valid = valid && !((order.buy == FieldT::zero()) && (order.allOrNone == FieldT::one()) && lt(fillAmountS, order.amountS));
        valid = valid && !((order.buy == FieldT::one()) && (order.allOrNone == FieldT::one()) && lt(fillAmountB, order.amountB));
        valid = valid && checkFillRate(order.amountS, order.amountB, fillAmountS, fillAmountB);
        valid = valid && ((fillAmountS == FieldT::zero() && fillAmountS == FieldT::zero()) || (fillAmountS != FieldT::zero() && fillAmountS != FieldT::zero()));
        return valid;
    }

    Settlement settle(const FieldT& timestamp, const OrderState& orderStateA, const OrderState& orderStateB)
    {
        Fill fillA = getMaxFillAmounts(orderStateA);
        Fill fillB = getMaxFillAmounts(orderStateB);

        bool matchable;
        if (orderStateA.order.buy == FieldT::one())
        {
            matchable = match(orderStateA.order, fillA, orderStateB.order, fillB);
            fillA.S = fillB.B;
        }
        else
        {
            matchable = match(orderStateB.order, fillB, orderStateA.order, fillA);
            fillA.B = fillB.S;
        }

        bool valid = matchable;
        valid = valid && checkValid(orderStateA.order, fillA.S, fillA.B, timestamp);
        valid = valid && checkValid(orderStateB.order, fillB.S, fillB.B, timestamp);

        return {fillA.S, fillB.S, valid};
    }
}

TEST_CASE("OrderMatching", "[OrderMatchingGadget]")
{
    enum class ExpectedSatisfied
    {
        Satisfied,
        NotSatisfied,
        Automatic
    };
    enum class ExpectedValid
    {
        Valid,
        Invalid,
        Automatic
    };
    enum class ExpectedFill
    {
        Manual,
        Automatic
    };
    auto orderMatchingChecked = [](const FieldT& _exchange, const FieldT& _timestamp,
                                   const OrderState& orderStateA, const OrderState& orderStateB,
                                   ExpectedSatisfied expectedSatisfied, ExpectedValid expectedValid = ExpectedValid::Valid,
                                   ExpectedFill expectedFill = ExpectedFill::Automatic, FieldT _expectedFillS_A = 0, FieldT _expectedFillS_B = 0)
    {
        protoboard<FieldT> pb;

        VariableT exchange = make_variable(pb, _exchange, "exchange");
        VariableT timestamp = make_variable(pb, _timestamp, "timestamp");

        jubjub::Params params;
        Constants constants(pb, "constants");

        OrderGadget orderA(pb, constants, exchange, ".orderA");
        orderA.generate_r1cs_witness(orderStateA.order);

        TradeHistoryGadget tradeHistoryDataA(pb, ".tradeHistoryA");
        tradeHistoryDataA.generate_r1cs_witness(orderStateA.tradeHistoryLeaf);

        TradeHistoryTrimmingGadget tradeHistoryA(pb, constants, tradeHistoryDataA, orderA.orderID, ".tradeHistoryTrimmingGadgetA");
        tradeHistoryA.generate_r1cs_witness();

        OrderGadget orderB(pb, constants, exchange, ".orderB");
        orderB.generate_r1cs_witness(orderStateB.order);

        TradeHistoryGadget tradeHistoryDataB(pb, ".tradeHistoryB");
        tradeHistoryDataB.generate_r1cs_witness(orderStateB.tradeHistoryLeaf);

        TradeHistoryTrimmingGadget tradeHistoryB(pb, constants, tradeHistoryDataB, orderB.orderID, ".tradeHistoryTrimmingGadgetB");
        tradeHistoryB.generate_r1cs_witness();

        unsigned int fFillS_A = toFloat(orderStateA.order.amountS, Float24Encoding);
        unsigned int fFillS_B = toFloat(orderStateB.order.amountS, Float24Encoding);

        bool expectedSatisfiedValue = true;
        FieldT limitA = orderStateA.order.buy == FieldT::one() ? orderStateA.order.amountB : orderStateA.order.amountS;
        expectedSatisfiedValue = lte(pb.val(tradeHistoryA.getFilled()), limitA);
        FieldT limitB = orderStateB.order.buy == FieldT::one() ? orderStateB.order.amountB : orderStateB.order.amountS;
        expectedSatisfiedValue = expectedSatisfiedValue && lte(pb.val(tradeHistoryB.getFilled()), limitB);

        if (expectedSatisfied != ExpectedSatisfied::Automatic)
        {
            expectedSatisfiedValue = (expectedSatisfied == ExpectedSatisfied::Satisfied) ? true : false;
        }

        Simulator::Settlement settlement = Simulator::settle(_timestamp, orderStateA, orderStateB);
        bool expectedValidValue = settlement.valid;
        if (expectedValid != ExpectedValid::Automatic)
        {
            expectedValidValue = (expectedValid == ExpectedValid::Valid) ? true : false;
        }

        if (expectedFill == ExpectedFill::Automatic)
        {
            _expectedFillS_A = settlement.fillS_A;
            _expectedFillS_B = settlement.fillS_B;
        }
        VariableT expectedFillS_A = make_variable(pb, roundToFloatValue(_expectedFillS_A, Float24Encoding), "expectedFillS_A");
        VariableT expectedFillS_B = make_variable(pb, roundToFloatValue(_expectedFillS_B, Float24Encoding), "expectedFillS_B");

        OrderMatchingGadget orderMatching(pb, constants, timestamp, orderA, orderB, tradeHistoryA.getFilled(), tradeHistoryB.getFilled(), expectedFillS_A, expectedFillS_B, "orderMatching");
        orderMatching.generate_r1cs_constraints();
        orderMatching.generate_r1cs_witness();

        REQUIRE(pb.is_satisfied() == (expectedSatisfiedValue && expectedValidValue));
        if (expectedSatisfiedValue && expectedValidValue)
        {
            auto tradeHistory_A = Simulator::getTradeHistory(orderStateA);
            REQUIRE((pb.val(orderMatching.getFilledAfter_A()) == (tradeHistory_A.filled + (orderStateA.order.buy == 1 ? pb.val(expectedFillS_B) : pb.val(expectedFillS_A)))));
            auto tradeHistory_B = Simulator::getTradeHistory(orderStateB);
            REQUIRE((pb.val(orderMatching.getFilledAfter_B()) == (tradeHistory_B.filled + (orderStateB.order.buy == 1 ? pb.val(expectedFillS_A) : pb.val(expectedFillS_B)))));
        }
    };

    Block block = getBlock();
    const UniversalTransaction& tx = getSpotTrade(block);

    const FieldT& exchange = block.exchange;
    const FieldT& timestamp = block.timestamp;

    const Order& A_order = tx.spotTrade.orderA;
    const Account& A_account = tx.witness.accountUpdate_A.before;
    const BalanceLeaf& A_balanceLeafS = tx.witness.balanceUpdateS_A.before;
    const BalanceLeaf& A_balanceLeafB = tx.witness.balanceUpdateB_A.before;
    const TradeHistoryLeaf& A_tradeHistoryLeaf = tx.witness.tradeHistoryUpdate_A.before;
    const OrderState orderStateA = {A_order, A_account, A_balanceLeafS, A_balanceLeafB, A_tradeHistoryLeaf};
    const FieldT expectFillS_A(fromFloat(tx.spotTrade.fillS_A.as_ulong(), Float24Encoding).to_string().c_str());

    const Order& B_order = tx.spotTrade.orderB;
    const Account& B_account = tx.witness.accountUpdate_B.before;
    const BalanceLeaf& B_balanceLeafS = tx.witness.balanceUpdateS_B.before;
    const BalanceLeaf& B_balanceLeafB = tx.witness.balanceUpdateB_B.before;
    const TradeHistoryLeaf& B_tradeHistoryLeaf = tx.witness.tradeHistoryUpdate_B.before;
    const OrderState orderStateB = {B_order, B_account, B_balanceLeafS, B_balanceLeafB, B_tradeHistoryLeaf};
    const FieldT expectFillS_B(fromFloat(tx.spotTrade.fillS_B.as_ulong(), Float24Encoding).to_string().c_str());

    unsigned int numTradeHistoryLeafs = pow(2, NUM_BITS_TRADING_HISTORY);
    const FieldT A_orderID = rand() % numTradeHistoryLeafs;
    const FieldT B_orderID = rand() % numTradeHistoryLeafs;

    FieldT maxAmount = getMaxFieldElement(NUM_BITS_AMOUNT);
    FieldT maxAmountFill = roundToFloatValue(maxAmount, Float24Encoding);

    SECTION("Valid order match")
    {
        orderMatchingChecked(
            exchange, timestamp,
            orderStateA, orderStateB,
            ExpectedSatisfied::Satisfied, ExpectedValid::Automatic,
            ExpectedFill::Manual, expectFillS_A, expectFillS_B
        );
    }

    SECTION("orderA.tokenS != orderB.tokenB")
    {
        OrderState orderStateA_mod = orderStateA;
        orderStateA_mod.order.tokenS += 1;
        orderMatchingChecked(
            exchange, timestamp,
            orderStateA_mod, orderStateB,
            ExpectedSatisfied::NotSatisfied
        );
    }

    SECTION("orderA.tokenB != orderB.tokenS")
    {
        OrderState orderStateB_mod = orderStateB;
        orderStateB_mod.order.tokenS += 1;
         orderMatchingChecked(
            exchange, timestamp,
            orderStateA, orderStateB_mod,
            ExpectedSatisfied::NotSatisfied
        );
    }

    SECTION("timestamp too early")
    {
        FieldT timestamp_mod = A_order.validSince - 1;
        orderMatchingChecked(
            exchange, timestamp_mod,
            orderStateA, orderStateB,
            ExpectedSatisfied::Satisfied, ExpectedValid::Invalid,
            ExpectedFill::Manual, expectFillS_A, expectFillS_B
        );
    }

    SECTION("timestamp too late")
    {
        FieldT timestamp_mod = B_order.validUntil + 1;
        orderMatchingChecked(
            exchange, timestamp_mod,
            orderStateA, orderStateB,
            ExpectedSatisfied::Satisfied, ExpectedValid::Invalid,
            ExpectedFill::Manual, expectFillS_A, expectFillS_B
        );
    }

    SECTION("orderA.amountS/B = maxAmount, orderB.amountS/B = maxAmount")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                maxAmount, maxAmount, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                maxAmount, maxAmount, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, maxAmountFill, maxAmountFill
            );
        }
    }

    SECTION("orderA.amountS/B = maxAmount, orderB.amountS/B = 1")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                maxAmount, maxAmount, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                1, 1, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, 1, 1
            );
        }
    }

    SECTION("orderA.amountS/B = 1, orderB.amountS/B = maxAmount")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                1, 1, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                maxAmount, maxAmount, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, 1, 1
            );
        }
    }

    SECTION("orderA.amountS/B = 1, orderB.amountS/B = 1")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                1, 1, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                1, 1, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, 1, 1
            );
        }
    }

    SECTION("orderA.amountS/B = maxAmount/1, orderB.amountS/B = maxAmount")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                maxAmount, 1, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                maxAmount, maxAmount, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, buyA ? 1 : maxAmount, buyA ? 1 : maxAmount
            );
        }
    }

    SECTION("orderA.amountS/B = 1/maxAmount, orderB.amountS/B = maxAmount")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                1, maxAmount, buyA,
                maxAmount,
                0, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                maxAmount, maxAmount, buyB,
                maxAmount,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Invalid,
                ExpectedFill::Manual, buyA ? maxAmountFill : 1, maxAmountFill
            );
        }
    }

    SECTION("orderA.amountS/B = [1/maxAmount], orderB.amountS/B = [1/maxAmount]")
    {
        for (unsigned int c = 0; c < pow(2, 6); c++)
        {
            FieldT A_amountS = (c >> 0) & 1 ? 1 : maxAmount;
            FieldT A_amountB = (c >> 1) & 1 ? 1 : maxAmount;
            FieldT B_amountS = (c >> 2) & 1 ? 1 : maxAmount;
            FieldT B_amountB = (c >> 3) & 1 ? 1 : maxAmount;

            FieldT A_balance = (c >> 4) & 1 ? 1 : maxAmount;
            FieldT B_balance = (c >> 4) & 1 ? 1 : maxAmount;

            for (unsigned int i = 0; i < 4; i++)
            {
                bool buyA = i % 2;
                bool buyB = i / 2;
                OrderState orderStateA_mod = setOrderState(
                    orderStateA,
                    A_orderID,
                    A_amountS, A_amountB, buyA,
                    A_balance,
                    0, A_orderID
                );
                OrderState orderStateB_mod = setOrderState(
                    orderStateB,
                    B_orderID,
                    B_amountS, B_amountB, buyB,
                    B_balance,
                    0, B_orderID
                );
                orderMatchingChecked(
                    exchange, timestamp,
                    orderStateA_mod, orderStateB_mod,
                    ExpectedSatisfied::Satisfied, ExpectedValid::Automatic,
                    ExpectedFill::Automatic
                );
            }
        }
    }

    SECTION("orderID == tradeHistory.orderID (filled amount > amountS/amountB)")
    {
        for (unsigned int i = 0; i < 2; i++)
        {
            bool buyA = i % 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                1, 1, buyA,
                maxAmount,
                maxAmount, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                1, 1, false,
                1,
                0, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Invalid,
                ExpectedFill::Manual, 0, 0
            );
        }
    }

    SECTION("orderID > tradeHistory.orderID")
    {
        for (unsigned int i = 0; i < 4; i++)
        {
            bool buyA = i % 2;
            bool buyB = i / 2;
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID + numTradeHistoryLeafs,
                maxAmount, maxAmount, buyA,
                maxAmount,
                maxAmount, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID + numTradeHistoryLeafs,
                maxAmount, maxAmount, buyB,
                maxAmount,
                maxAmount, B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
                ExpectedFill::Manual, maxAmount, maxAmount
            );
        }
    }

    SECTION("allOrNone (buy)")
    {
        for (unsigned int i = 0; i < 200; i++)
        {
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                200, 100, true,
                2*i,
                0, A_orderID,
                true
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                100, 100, bool(rand() % 2),
                maxAmount,
                0, B_orderID
            );

            ExpectedValid expectedValid = (i >= 50) ? ExpectedValid::Valid : ExpectedValid::Invalid;
            FieldT expectedFill = (2*i >= 100) ? 100 : 2*i;
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, expectedValid,
                ExpectedFill::Manual, expectedFill, expectedFill
            );
        }
    }

    SECTION("allOrNone (sell)")
    {
        for (unsigned int i = 0; i < 400; i+=2)
        {
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                200, 100, false,
                i,
                0, A_orderID,
                true
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                400, 400, bool(rand() % 2),
                maxAmount,
                0, B_orderID
            );

            ExpectedValid expectedValid = (i >= 200) ? ExpectedValid::Valid : ExpectedValid::Invalid;
            FieldT expectedFill = (i >= 200) ? 200 : i;
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, expectedValid,
                ExpectedFill::Manual, expectedFill, expectedFill
            );
        }
    }

    SECTION("Filled (buy)")
    {
        for (unsigned int i = 0; i < 400; i+=2)
        {
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                400, 200, true,
                maxAmount,
                i, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                400, 400, bool(rand() % 2),
                maxAmount,
                0, B_orderID
            );

            ExpectedValid expectedValid = (i <= 200) ? ExpectedValid::Valid : ExpectedValid::Invalid;
            FieldT expectedFill = (i < 200) ? 200 - i : 0;
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, expectedValid,
                ExpectedFill::Manual, expectedFill, expectedFill
            );
        }
    }

    SECTION("Filled (sell)")
    {
        for (unsigned int i = 0; i < 400; i+=2)
        {
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                200, 100, false,
                maxAmount,
                i, A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                400, 400, bool(rand() % 2),
                maxAmount,
                0, B_orderID
            );

            ExpectedValid expectedValid = (i <= 200) ? ExpectedValid::Valid : ExpectedValid::Invalid;
            FieldT expectedFill = (i < 200) ? 200 - i : 0;
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Satisfied, expectedValid,
                ExpectedFill::Manual, expectedFill, expectedFill
            );
        }
    }

    SECTION("Random")
    {
        for (unsigned int i = 0; i < 128; i++)
        {
            OrderState orderStateA_mod = setOrderState(
                orderStateA,
                A_orderID,
                getRandomFieldElement(NUM_BITS_AMOUNT), getRandomFieldElement(NUM_BITS_AMOUNT), bool(rand() % 2),
                getRandomFieldElement(NUM_BITS_AMOUNT),
                getRandomFieldElement(NUM_BITS_AMOUNT), A_orderID
            );
            OrderState orderStateB_mod = setOrderState(
                orderStateB,
                B_orderID,
                getRandomFieldElement(NUM_BITS_AMOUNT), getRandomFieldElement(NUM_BITS_AMOUNT), bool(rand() % 2),
                getRandomFieldElement(NUM_BITS_AMOUNT),
                getRandomFieldElement(NUM_BITS_AMOUNT), B_orderID
            );
            orderMatchingChecked(
                exchange, timestamp,
                orderStateA_mod, orderStateB_mod,
                ExpectedSatisfied::Automatic, ExpectedValid::Automatic,
                ExpectedFill::Automatic
            );
        }
    }

    SECTION("Regression Case 1, expectedFill as maxFill causes order mismatch")
    {
        OrderState orderStateA_mod = setOrderState(
            orderStateA,
            A_orderID,
            FieldT("74437628000000000000000"), FieldT("63821764000000000000000"), false,
            FieldT("89266748000000000000000"),
            0, A_orderID
        );
        OrderState orderStateB_mod = setOrderState(
            orderStateB,
            B_orderID,
            FieldT("42719051000000000000000"), FieldT("2883176000000000000000"), true,
            FieldT("42719180000000000000000"),
            0, B_orderID
        );
        FieldT expectedFillS_A("2883170000000000000000");
        FieldT expectedFillS_B("42719000000000000000000");
        orderMatchingChecked(
            exchange, timestamp,
            orderStateA_mod, orderStateB_mod,
            ExpectedSatisfied::Satisfied, ExpectedValid::Valid,
            ExpectedFill::Manual, expectedFillS_A, expectedFillS_B
        );
    }
}
