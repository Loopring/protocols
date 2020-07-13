#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/OrderGadgets.h"


TEST_CASE("Order", "[OrderGadget]")
{
    // We can't easily create signatures here, so disable the signature check for some tests
    bool doSignatureCheck = true;

    auto orderChecked = [&doSignatureCheck](const FieldT& _exchangeID,
                                            const Order& order, const Account& account,
                                            const BalanceLeaf& balanceLeafS, const BalanceLeaf& balanceLeafB,
                                            const TradeHistoryLeaf& tradeHistoryLeaf,
                                            bool expectedSatisfied)
    {
        protoboard<FieldT> pb;

        VariableT exchangeID = make_variable(pb, _exchangeID, "exchangeID");

        jubjub::Params params;
        Constants constants(pb, "constants");
        OrderGadget orderGadget(pb, params, constants, exchangeID, ".order");

        orderGadget.generate_r1cs_witness(order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf);
        orderGadget.generate_r1cs_constraints(doSignatureCheck);

        REQUIRE(pb.is_satisfied() == expectedSatisfied);

        return pb.val(orderGadget.hasRebate());
    };

    RingSettlementBlock block = getRingSettlementBlock();
    REQUIRE(block.ringSettlements.size() > 0);
    const RingSettlement& ringSettlement = block.ringSettlements[0];

    const FieldT& exchangeID = block.exchangeID;
    const Order& order = ringSettlement.ring.orderA;
    const Account& account = ringSettlement.accountUpdate_A.before;
    const BalanceLeaf& balanceLeafS = ringSettlement.balanceUpdateS_A.before;
    const BalanceLeaf& balanceLeafB = ringSettlement.balanceUpdateB_A.before;
    const TradeHistoryLeaf& tradeHistoryLeaf = ringSettlement.tradeHistoryUpdate_A.before;

    const Account& account2 = ringSettlement.accountUpdate_B.before;

    SECTION("Valid order")
    {
        orderChecked(exchangeID, order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, true);
    }

    SECTION("Different exchangeID")
    {
        orderChecked(exchangeID + 1, order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
    }

    SECTION("Wrong signature for the account")
    {
        orderChecked(exchangeID, order, account2, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
    }

    SECTION("Wrong order data")
    {
        SECTION("orderID")
        {
            Order _order = order;
            _order.orderID += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("accountID")
        {
            Order _order = order;
            _order.accountID += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("tokenS")
        {
            Order _order = order;
            _order.tokenS += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("tokenB")
        {
            Order _order = order;
            _order.tokenB += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("amountS")
        {
            Order _order = order;
            _order.amountS += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("amountB")
        {
            Order _order = order;
            _order.amountB += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("allOrNone")
        {
            Order _order = order;
            _order.allOrNone = (order.allOrNone == FieldT::one()) ? FieldT::zero() : FieldT::one();
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("validSince")
        {
            Order _order = order;
            _order.validSince += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("validUntil")
        {
            Order _order = order;
            _order.validUntil += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("maxFeeBips")
        {
            Order _order = order;
            _order.maxFeeBips += 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("buy")
        {
            Order _order = order;
            _order.buy = (order.buy == FieldT::one()) ? FieldT::zero() : FieldT::one();
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
    }

    doSignatureCheck = false;

    SECTION("order data > max allowed values")
    {
        SECTION("orderID")
        {
            Order _order = order;
            _order.orderID = getMaxFieldElement(NUM_BITS_ORDERID) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("accountID")
        {
            Order _order = order;
            _order.accountID = getMaxFieldElement(NUM_BITS_ACCOUNT) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("tokenS")
        {
            Order _order = order;
            _order.tokenS = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("tokenB")
        {
            Order _order = order;
            _order.tokenB = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("amountS")
        {
            Order _order = order;
            _order.amountS = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("amountB")
        {
            Order _order = order;
            _order.amountB = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("allOrNone")
        {
            Order _order = order;
            _order.allOrNone = 2;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("validSince")
        {
            Order _order = order;
            _order.validSince = getMaxFieldElement(NUM_BITS_TIMESTAMP) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("validUntil")
        {
            Order _order = order;
            _order.validUntil = getMaxFieldElement(NUM_BITS_TIMESTAMP) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("maxFeeBips")
        {
            Order _order = order;
            _order.maxFeeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("buy")
        {
            Order _order = order;
            _order.buy = 2;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("feeBips")
        {
            Order _order = order;
            _order.feeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            _order.rebateBips = 0;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("rebateBips")
        {
            Order _order = order;
            _order.feeBips = 0;
            _order.rebateBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
    }

    SECTION("invalid order data")
    {
        SECTION("feeBips != 0 && rebateBips != 0")
        {
            Order _order = order;
            _order.feeBips = 2;
            _order.rebateBips = 1;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
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
                    orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, expectedSatisfied);
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
                orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
            }
        }
        SECTION("amountS == 0")
        {
            Order _order = order;
            _order.amountS = 0;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
        SECTION("amountB == 0")
        {
            Order _order = order;
            _order.amountB = 0;
            orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, false);
        }
    }

    SECTION("hasRebate")
    {
        Order _order = order;
        {
            _order.feeBips = 10;
            _order.rebateBips = 0;
            auto data = orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, true);
            REQUIRE((data == FieldT::zero()));
        }
        {
            _order.feeBips = 0;
            _order.rebateBips = 10;
            auto data = orderChecked(exchangeID, _order, account, balanceLeafS, balanceLeafB, tradeHistoryLeaf, true);
            REQUIRE((data == FieldT::one()));
        }
    }
}
