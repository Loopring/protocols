#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/OrderGadgets.h"


TEST_CASE("Order", "[OrderGadget]")
{
    // We can't easily create signatures here, so disable the signature check for some tests
    bool doSignatureCheck = true;

    auto orderChecked = [&doSignatureCheck](const FieldT& _exchange,
                                            const Order& order,
                                            bool expectedSatisfied)
    {
        protoboard<FieldT> pb;

        VariableT exchange = make_variable(pb, _exchange, "exchange");

        Constants constants(pb, "constants");
        OrderGadget orderGadget(pb, constants, exchange, ".order");

        orderGadget.generate_r1cs_witness(order);
        orderGadget.generate_r1cs_constraints(doSignatureCheck);

        REQUIRE(pb.is_satisfied() == expectedSatisfied);

        return pb.val(orderGadget.hasRebate());
    };

    Block block = getBlock();
    const UniversalTransaction& tx = getSpotTrade(block);

    const FieldT& exchange = block.exchange;
    const Order& order = tx.spotTrade.orderA;

    const Account& account2 = tx.witness.accountUpdate_B.before;

    SECTION("Valid order")
    {
        orderChecked(exchange, order, true);
    }

    SECTION("order data > max allowed values")
    {
        SECTION("orderID")
        {
            Order _order = order;
            _order.orderID = getMaxFieldElement(NUM_BITS_ORDERID) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("accountID")
        {
            Order _order = order;
            _order.accountID = getMaxFieldElement(NUM_BITS_ACCOUNT) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("tokenS")
        {
            Order _order = order;
            _order.tokenS = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("tokenB")
        {
            Order _order = order;
            _order.tokenB = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("amountS")
        {
            Order _order = order;
            _order.amountS = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("amountB")
        {
            Order _order = order;
            _order.amountB = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("allOrNone")
        {
            Order _order = order;
            _order.allOrNone = 2;
            orderChecked(exchange, _order, false);
        }
        SECTION("validSince")
        {
            Order _order = order;
            _order.validSince = getMaxFieldElement(NUM_BITS_TIMESTAMP) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("validUntil")
        {
            Order _order = order;
            _order.validUntil = getMaxFieldElement(NUM_BITS_TIMESTAMP) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("maxFeeBips")
        {
            Order _order = order;
            _order.maxFeeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("buy")
        {
            Order _order = order;
            _order.buy = 2;
            orderChecked(exchange, _order, false);
        }
        SECTION("feeBips")
        {
            Order _order = order;
            _order.feeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            _order.rebateBips = 0;
            orderChecked(exchange, _order, false);
        }
        SECTION("rebateBips")
        {
            Order _order = order;
            _order.feeBips = 0;
            _order.rebateBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            orderChecked(exchange, _order, false);
        }
    }

    SECTION("invalid order data")
    {
        SECTION("feeBips != 0 && rebateBips != 0")
        {
            Order _order = order;
            _order.feeBips = 2;
            _order.rebateBips = 1;
            orderChecked(exchange, _order, false);
        }
        SECTION("feeBips > maxFeeBips")
        {
            Order _order = order;
            for (unsigned int maxFeeBips = 0; maxFeeBips < pow(2, NUM_BITS_BIPS); maxFeeBips += 3)
            {
                for (unsigned int feeBips = 0; feeBips < pow(2, NUM_BITS_BIPS); feeBips += 3)
                {
                    _order.maxFeeBips = maxFeeBips;
                    _order.feeBips = feeBips;
                    _order.rebateBips = 0;
                    bool expectedSatisfied = (feeBips <= maxFeeBips);
                    orderChecked(exchange, _order, expectedSatisfied);
                }
            }
        }
        SECTION("tokenS == tokenB")
        {
            Order _order = order;
            for (unsigned int tokenID = 0; tokenID < pow(2, NUM_BITS_TOKEN); tokenID += 3)
            {
                _order.tokenS = tokenID;
                _order.tokenB = tokenID;
                orderChecked(exchange, _order, false);
            }
        }
        SECTION("amountS == 0")
        {
            Order _order = order;
            _order.amountS = 0;
            orderChecked(exchange, _order, false);
        }
        SECTION("amountB == 0")
        {
            Order _order = order;
            _order.amountB = 0;
            orderChecked(exchange, _order, false);
        }
    }

    SECTION("hasRebate")
    {
        Order _order = order;
        {
            _order.feeBips = 10;
            _order.rebateBips = 0;
            auto data = orderChecked(exchange, _order, true);
            REQUIRE((data == FieldT::zero()));
        }
        {
            _order.feeBips = 0;
            _order.rebateBips = 10;
            auto data = orderChecked(exchange, _order, true);
            REQUIRE((data == FieldT::one()));
        }
    }
}
