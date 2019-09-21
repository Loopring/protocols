import { BigNumber } from "bignumber.js";
import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  DummyBrokerDelegate,
  DummyToken,
  OrderBook,
  OrderRegistry,
  LRCToken,
} = new Artifacts(artifacts);

contract("IBrokerDelegate", (accounts: string[]) => {
  const deployer = accounts[0];
  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.options.address,
                                            exchangeTestUtil.context.tradeHistory.options.address,
                                            exchangeTestUtil.context.feeHolder.options.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.methods.authorizeAddress(
      dummyExchange.address,
    ).send({from: exchangeTestUtil.testContext.deployer});
  });

  const toBN = (value: number) => {
    return web3.utils.toBN(new BigNumber(value.toString()));
  };

  const addLRCBalance = async (user: string, amount: number) => {
    const amountBN = toBN(amount);
    const LRC = await DummyToken.at(LRCToken.address);
    await LRC.transfer(user, amountBN, {from: deployer});
  };

  it("should be able to trade from a broker contract that implements IBrokerDelegate", async () => {
    const dummyBroker = await DummyBrokerDelegate.new();

    await addLRCBalance(dummyBroker.address, 1500e18);

    const ringsInfo: pjs.RingsInfo = {
      rings: [[0, 1]],
      orders: [
        {
          tokenS: "LRC",
          tokenB: "WETH",
          amountS: 1000e18,
          amountB: 1e18,
          balanceS: 1e26,
          balanceFee: 1e26,
          balanceB: 1e26,
          broker: dummyBroker.address,
        },
        {
          tokenS: "WETH",
          tokenB: "LRC",
          amountS: 1e18,
          amountB: 1000e18,
          balanceS: 1e26,
          balanceFee: 1e26,
          balanceB: 1e26,
        },
      ],
    };
    await exchangeTestUtil.setupRings(ringsInfo);
    await exchangeTestUtil.submitRings(ringsInfo, dummyExchange);
  });
});
