import BN = require("bn.js");
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let exchangeId = 0;

  // let operator: any;

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], bSetupTestState);
    exchange = exchangeTestUtil.exchange;
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  beforeEach(async () => {
    exchangeId = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], true);
  });

  describe("Operator", function() {
    this.timeout(0);

    it("Sample test", async () => {
      // operator = await exchangeTestUtil.contracts.Operator.new(exchange.address);
      // await exchange.setOperator(operator.address, {from: exchangeTestUtil.exchangeOwner});

      const ring: RingInfo = {
        orderA:
          {
            realmID: exchangeId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID: exchangeId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            amountF: new BN(web3.utils.toWei("3", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

  });
});
