#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/OrderGadgets.h"

TEST_CASE("Order", "[OrderGadget]")
{
    auto orderChecked = [&](const FieldT &_exchange, const Order &order, bool expectedSatisfied) {
        protoboard<FieldT> pb;

        VariableT exchange = make_variable(pb, _exchange, "exchange");

        Constants constants(pb, "constants");
        OrderGadget orderGadget(pb, constants, exchange, ".order");

        orderGadget.generate_r1cs_witness(order);
        orderGadget.generate_r1cs_constraints();

        REQUIRE(pb.is_satisfied() == expectedSatisfied);
    };

    Block block = getBlock();
    const UniversalTransaction &tx = getSpotTrade(block);

    const FieldT &exchange = block.exchange;
    const Order &order = tx.spotTrade.orderA;

    const AccountLeaf &account2 = tx.witness.accountUpdate_B.before;

    SECTION("Valid order")
    {
        orderChecked(exchange, order, true);
    }

    SECTION("order data > max allowed values")
    {
        SECTION("storageID")
        {
            Order _order = order;
            _order.storageID = getMaxFieldElement(NUM_BITS_STORAGEID) + 1;
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
        SECTION("fillAmountBorS")
        {
            Order _order = order;
            _order.fillAmountBorS = 2;
            orderChecked(exchange, _order, false);
        }
        SECTION("feeBips")
        {
            Order _order = order;
            _order.feeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            orderChecked(exchange, _order, false);
        }
    }

    SECTION("invalid order data")
    {
        SECTION("feeBips > maxFeeBips")
        {
            Order _order = order;
            for (unsigned int maxFeeBips = 0; maxFeeBips < pow(2, NUM_BITS_BIPS_DA); maxFeeBips += 3)
            {
                for (unsigned int feeBips = 0; feeBips < pow(2, NUM_BITS_BIPS_DA); feeBips += 3)
                {
                    _order.maxFeeBips = maxFeeBips;
                    _order.feeBips = feeBips;
                    bool expectedSatisfied = (feeBips <= maxFeeBips);
                    orderChecked(exchange, _order, expectedSatisfied);
                }
            }
            unsigned int feeBipsLimit = pow(2, NUM_BITS_BIPS_DA) * FEE_MULTIPLIER;
            for (unsigned int maxFeeBips = 0; maxFeeBips < feeBipsLimit; maxFeeBips += 150)
            {
                for (unsigned int feeBips = 0; feeBips < feeBipsLimit; feeBips += 150)
                {
                    _order.maxFeeBips = maxFeeBips;
                    _order.feeBips = feeBips;
                    bool expectedSatisfied = (feeBips <= maxFeeBips);
                    orderChecked(exchange, _order, expectedSatisfied);
                }
            }

            _order.maxFeeBips = 1002;
            _order.feeBips = 1000;
            orderChecked(exchange, _order, true);

            _order.maxFeeBips = 200;
            _order.feeBips = 103;
            orderChecked(exchange, _order, false);

            _order.maxFeeBips = feeBipsLimit - 1;
            _order.feeBips = feeBipsLimit - FEE_MULTIPLIER;
            orderChecked(exchange, _order, true);

            _order.maxFeeBips = feeBipsLimit;
            _order.feeBips = feeBipsLimit;
            orderChecked(exchange, _order, false);

            _order.maxFeeBips = feeBipsLimit - FEE_MULTIPLIER;
            _order.feeBips = feeBipsLimit - FEE_MULTIPLIER;
            orderChecked(exchange, _order, true);
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
}
