#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/OrderGadgets.h"

TEST_CASE("Order", "[OrderGadget]") {
  // We can't easily create signatures here, so disable the signature check for
  // some tests
  bool doSignatureCheck = true;

  auto orderChecked = [&doSignatureCheck](const FieldT &_exchange,
                                          const Order &order,
                                          bool expectedSatisfied) {
    protoboard<FieldT> pb;

    VariableT exchange = make_variable(pb, _exchange, "exchange");

    Constants constants(pb, "constants");
    OrderGadget orderGadget(pb, constants, exchange, ".order");

    orderGadget.generate_r1cs_witness(order);
    orderGadget.generate_r1cs_constraints(doSignatureCheck);

    REQUIRE(pb.is_satisfied() == expectedSatisfied);
  };

  Block block = getBlock();
  const UniversalTransaction &tx = getSpotTrade(block);

  const FieldT &exchange = block.exchange;
  const Order &order = tx.spotTrade.orderA;

  const Account &account2 = tx.witness.accountUpdate_B.before;

  SECTION("Valid order") { orderChecked(exchange, order, true); }

  SECTION("order data > max allowed values") {
    SECTION("storageID") {
      Order _order = order;
      _order.storageID = getMaxFieldElement(NUM_BITS_STORAGEID) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("accountID") {
      Order _order = order;
      _order.accountID = getMaxFieldElement(NUM_BITS_ACCOUNT) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("tokenS") {
      Order _order = order;
      _order.tokenS = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("tokenB") {
      Order _order = order;
      _order.tokenB = getMaxFieldElement(NUM_BITS_TOKEN) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("amountS") {
      Order _order = order;
      _order.amountS = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("amountB") {
      Order _order = order;
      _order.amountB = getMaxFieldElement(NUM_BITS_AMOUNT) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("validUntil") {
      Order _order = order;
      _order.validUntil = getMaxFieldElement(NUM_BITS_TIMESTAMP) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("maxFeeBips") {
      Order _order = order;
      _order.maxFeeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
      orderChecked(exchange, _order, false);
    }
    SECTION("buy") {
      Order _order = order;
      _order.buy = 2;
      orderChecked(exchange, _order, false);
    }
    SECTION("feeBips") {
      Order _order = order;
      _order.feeBips = getMaxFieldElement(NUM_BITS_BIPS) + 1;
      orderChecked(exchange, _order, false);
    }
  }

  SECTION("invalid order data") {
    SECTION("feeBips > maxFeeBips") {
      Order _order = order;
      for (unsigned int maxFeeBips = 0; maxFeeBips < pow(2, NUM_BITS_BIPS);
           maxFeeBips += 3) {
        for (unsigned int feeBips = 0; feeBips < pow(2, NUM_BITS_BIPS);
             feeBips += 3) {
          _order.maxFeeBips = maxFeeBips;
          _order.feeBips = feeBips;
          bool expectedSatisfied = (feeBips <= maxFeeBips);
          orderChecked(exchange, _order, expectedSatisfied);
        }
      }
    }
    SECTION("tokenS == tokenB") {
      Order _order = order;
      for (unsigned int tokenID = 0; tokenID < pow(2, NUM_BITS_TOKEN);
           tokenID += 3) {
        _order.tokenS = tokenID;
        _order.tokenB = tokenID;
        orderChecked(exchange, _order, false);
      }
    }
    SECTION("amountS == 0") {
      Order _order = order;
      _order.amountS = 0;
      orderChecked(exchange, _order, false);
    }
    SECTION("amountB == 0") {
      Order _order = order;
      _order.amountB = 0;
      orderChecked(exchange, _order, false);
    }
  }
}
