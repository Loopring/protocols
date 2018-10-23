import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  OrderBook,
  OrderRegistry,
} = new Artifacts(artifacts);

contract("SubmitRings_Benchmark", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;
  let orderBook: any;
  let orderRegistry: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    orderBook = await OrderBook.deployed();
    orderRegistry = await OrderRegistry.deployed();

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.address,
                                            exchangeTestUtil.context.feeHolder.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.authorizeAddress(dummyExchange.address,
                                                                  {from: exchangeTestUtil.testContext.deployer});
  });

  describe("submitRings", () => {
    let simpleRingGas = 0;
    let typicalRingGas = 0;
    let p2pRingGas = 0;
    let multiRingGas = 0;

    it("the first one, always cost more gas than expected, ignore this one", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "LRC",
            amountS: 1e18,
            amountB: 1000e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 1000e18,
            amountB: 1e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

    it("single simple ring", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 1e18,
            amountB: 3000e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 3000e18,
            amountB: 1e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const res = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      simpleRingGas = res.tx.receipt.gasUsed;
    });

    it("single most typical ring", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const res = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      typicalRingGas = res.tx.receipt.gasUsed;
    });

    it("single typical P2P ring", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            owner: "0",
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 100e18,
            amountB: 380e18,
            tokenSFeePercentage: 60,  // == 6.0%
            tokenBFeePercentage: 100,  // == 10.0%
            walletAddr: "0",
            balanceS: 1e26,
            balanceB: 1e26,
          },
          {
            owner: "1",
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 400e18,
            amountB: 94e18,
            tokenSFeePercentage: 50,  // == 5.0%
            tokenBFeePercentage: 25,  // == 2.5%
            walletAddr: "1",
            balanceS: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const res = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      p2pRingGas = res.tx.receipt.gasUsed;
    });

    it("typical multi-ring case where an order is filled by multiple orders", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1], [0, 2]],
        orders: [
          {
            index: 0,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 100e18,
            amountB: 10e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            index: 1,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 5e18,
            amountB: 50e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            index: 2,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 5e18,
            amountB: 45e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const res = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      multiRingGas = res.tx.receipt.gasUsed;
    });

    it("", async () => {
      pjs.logInfo("");
      pjs.logInfo("-".repeat(32));
      pjs.logInfo("Benchmark gas usage report: ");
      pjs.logInfo("simpleRingGas:  " + simpleRingGas);
      pjs.logInfo("typicalRingGas: " + typicalRingGas);
      pjs.logInfo("p2pRingGas:     " + p2pRingGas);
      pjs.logInfo("multiRingGas:   " + multiRingGas);

      const average = Math.floor((simpleRingGas + typicalRingGas + p2pRingGas + multiRingGas) / 4);
      pjs.logInfo("average:        " + average);
      pjs.logInfo("-".repeat(32));
    });
  });

});
