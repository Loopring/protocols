import * as psc from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  BrokerRegistry,
  DummyBrokerInterceptor,
} = new Artifacts(artifacts);

contract("Exchange_Security", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

  const registerBrokerChecked = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(exchangeTestUtil.context.orderBrokerRegistry.address);
    await brokerRegistry.registerBroker(broker, interceptor, {from: user});
    await assertRegistered(user, broker, interceptor);
  };

  const unregisterBrokerChecked = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(exchangeTestUtil.context.orderBrokerRegistry.address);
    await brokerRegistry.unregisterBroker(broker, {from: user});
    await assertNotRegistered(user, broker);
  };

  const assertRegistered = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(exchangeTestUtil.context.orderBrokerRegistry.address);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(isRegistered, "interceptor should be registered.");
    assert.equal(interceptor, interceptorFromContract, "get wrong interceptor");
  };

  const assertNotRegistered = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(exchangeTestUtil.context.orderBrokerRegistry.address);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(!isRegistered, "interceptor should not be registered.");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Security", () => {

    beforeEach(async () => {
      await exchangeTestUtil.cleanTradeHistory();
    });

    it("Reentrancy attack", async () => {
      const broker = exchangeTestUtil.testContext.brokers[0];
      const ringsInfo: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
            broker,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
        transactionOrigin: exchangeTestUtil.testContext.transactionOrigin,
        feeRecipient: exchangeTestUtil.testContext.feeRecipient,
        miner: exchangeTestUtil.testContext.miner,
      };

      // A ring without callbacks so submitRings doesn't get into an infinite loop
      // in a reentrancy scenario
      const ringsInfoAttack: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 25e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 32e17,
          },
        ],
        transactionOrigin: exchangeTestUtil.testContext.transactionOrigin,
        feeRecipient: exchangeTestUtil.testContext.feeRecipient,
        miner: exchangeTestUtil.testContext.miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await exchangeTestUtil.setupOrder(order, i);
      }

      for (const [i, order] of ringsInfoAttack.orders.entries()) {
        await exchangeTestUtil.setupOrder(order, i);
      }

      const owner = ringsInfo.orders[0].owner;
      const attackBrokerInterceptor = await DummyBrokerInterceptor.new(exchangeTestUtil.ringSubmitter.address);

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker, attackBrokerInterceptor.address);

      // Set the allowance to a large number
      await attackBrokerInterceptor.setAllowance(1e32);

      // Enable the Reentrancy attack
      // Create a valid ring that can be submitted by the interceptor
      {
        const ringsGeneratorAttack = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGeneratorAttack.setupRingsAsync(ringsInfoAttack);
        const bsAttack = ringsGeneratorAttack.toSubmitableParam(ringsInfoAttack);
        // Enable the reentrancy attack on the interceptor
        await attackBrokerInterceptor.setReentrancyAttackEnabled(true, bsAttack);
      }

      // Setup the ring
      const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // submitRings currently does not throw because external calls cannot fail the transaction
      exchangeTestUtil.ringSubmitter.submitRings(bs, {from: exchangeTestUtil.testContext.transactionOrigin});

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker);
    });

  });

});
