#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/TradingHistoryGadgets.h"

TEST_CASE("TradeHistoryTrimming", "[TradeHistoryTrimmingGadget]")
{
    auto tradeHistoryTrimmingChecked = [](const TradeHistoryLeaf& tradeHistoryLeaf, const FieldT& _orderID,
                                          bool expectedSatisfied, const FieldT& expectedFilled = FieldT::zero(), const FieldT& expectedOverwrite = FieldT::zero())
    {
        protoboard<FieldT> pb;

        TradeHistoryGadget tradeHistory(pb, "tradeHistory");
        tradeHistory.generate_r1cs_witness(tradeHistoryLeaf);

        DualVariableGadget orderID(pb, NUM_BITS_ORDERID, "orderID");
        orderID.generate_r1cs_witness(pb, _orderID);

        jubjub::Params params;
        Constants constants(pb, "constants");
        TradeHistoryTrimmingGadget tradeHistoryTrimmingGadget(
            pb, constants, tradeHistory, orderID, "tradeHistoryTrimmingGadget"
        );
        tradeHistoryTrimmingGadget.generate_r1cs_witness();
        tradeHistoryTrimmingGadget.generate_r1cs_constraints();

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
        if (expectedSatisfied)
        {
            REQUIRE((pb.val(tradeHistoryTrimmingGadget.getFilled()) == expectedFilled));
            REQUIRE((pb.val(tradeHistoryTrimmingGadget.getOverwrite()) == expectedOverwrite));
        }
    };

    unsigned int delta = pow(2, NUM_BITS_TRADING_HISTORY);
    unsigned int orderID = rand() % delta;
    FieldT filled = getRandomFieldElement(NUM_BITS_AMOUNT);

    SECTION("orderID == tradeHistoryOrderID")
    {
        SECTION("Initial state orderID == 0")
        {
            tradeHistoryTrimmingChecked({0, 0}, 0,
                                        true, 0, 0);
        }
        SECTION("Initial state orderID > 0")
        {
            tradeHistoryTrimmingChecked({0, 0}, orderID,
                                        true, 0, 0);
        }
        SECTION("Order filled")
        {
            tradeHistoryTrimmingChecked({filled, orderID}, orderID,
                                        true, filled, 0);
        }
        SECTION("Initial state orderID == delta - 1")
        {
            tradeHistoryTrimmingChecked({0, 0}, delta - 1,
                                        true, 0, 0);
        }
    }

    SECTION("orderID > tradeHistoryOrderID (trimmed)")
    {
        SECTION("First overwrite")
        {
            tradeHistoryTrimmingChecked({0, 0}, delta,
                                        true, 0, 1);
        }
        SECTION("Previous order not filled")
        {
            tradeHistoryTrimmingChecked({0, orderID}, delta + orderID,
                                        true, 0, 1);
        }
        SECTION("Previous order filled")
        {
            tradeHistoryTrimmingChecked({filled, orderID}, delta + orderID,
                                        true, 0, 1);
        }
        SECTION("Max overwrite delta")
        {
            tradeHistoryTrimmingChecked({0, 0}, delta + orderID,
                                        true, 0, 1);
        }
        SECTION("orderID too big")
        {
            tradeHistoryTrimmingChecked({0, 0}, delta + delta + orderID,
                                        false);
            tradeHistoryTrimmingChecked({0, 0}, delta * 9 + orderID,
                                        false);
            tradeHistoryTrimmingChecked({0, 0}, delta * 99 + orderID,
                                        false);
            tradeHistoryTrimmingChecked({0, 0}, delta * 999 + orderID,
                                        false);
            tradeHistoryTrimmingChecked({0, 0}, delta * 9999 + orderID,
                                        false);
        }
    }

    SECTION("orderID < tradeHistoryOrderID (cancelled)")
    {
        SECTION("First rejection")
        {
            tradeHistoryTrimmingChecked({0, 0}, delta * 2,
                                        false);
        }
        SECTION("New order not filled")
        {
            tradeHistoryTrimmingChecked({0, delta + orderID}, orderID,
                                        false);
        }
        SECTION("New order filled")
        {
            tradeHistoryTrimmingChecked({filled, delta + orderID}, orderID,
                                        false);
        }
    }
}
