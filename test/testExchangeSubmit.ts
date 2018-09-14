import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  OrderBook,
} = new Artifacts(artifacts);

contract("Exchange_Submit", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;
  let orderBook: any;

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    orderBook = await OrderBook.deployed();

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.address,
                                            exchangeTestUtil.context.feeHolder.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.authorizeAddress(dummyExchange.address,
                                                                  {from: exchangeTestUtil.testContext.deployer});
  });

  describe("submitRing", () => {

    for (const ringsInfo of ringsInfoList) {
      it(ringsInfo.description, async () => {
        await exchangeTestUtil.setupRings(ringsInfo);
        await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      });
    }

    it("on-chain order should be able to dealed with off-chain order", async () => {
      const gtoAddr = exchangeTestUtil.testContext.tokenSymbolAddrMap.get("GTO");
      const wethAddr = exchangeTestUtil.testContext.tokenSymbolAddrMap.get("WETH");

      const onChainOrder: pjs.OrderInfo = {
        index: 0,
        owner: exchangeTestUtil.testContext.orderOwners[0],
        tokenS: gtoAddr,
        tokenB: wethAddr,
        amountS: 10000e18,
        amountB: 3e18,
        validSince: web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000,
        validUntil: web3.eth.getBlock(web3.eth.blockNumber).timestamp + 360000,
        feeAmount: 1e18,
        allOrNone: false,
      };

      // onChainOrder.tokenS = await symbolRegistry.getAddressBySymbol(onChainOrder.tokenS);
      // onChainOrder.tokenB = await symbolRegistry.getAddressBySymbol(onChainOrder.tokenB);

      const orderUtil = new pjs.OrderUtil(undefined);
      const bytes32Array = orderUtil.toOrderBookSubmitParams(onChainOrder);
      await /*exchangeTestUtil.context.*/orderBook.submitOrder(bytes32Array);

      const offChainOrder: pjs.OrderInfo = {
        index: 1,
        tokenS: wethAddr,
        tokenB: gtoAddr,
        amountS: 3e18,
        amountB: 10000e18,
        validSince: web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000,
        validUntil: web3.eth.getBlock(web3.eth.blockNumber).timestamp + 360000,
        feeAmount: 1e18,
        allOrNone: false,
      };

      await exchangeTestUtil.setupOrder(offChainOrder, 1);
      await exchangeTestUtil.setOrderBalances(onChainOrder);

      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          onChainOrder,
          offChainOrder,
        ],
      };
      ringsInfo.transactionOrigin = exchangeTestUtil.testContext.transactionOrigin;
      ringsInfo.feeRecipient = exchangeTestUtil.testContext.miner;
      ringsInfo.miner = exchangeTestUtil.testContext.miner;
      // await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
    });

    it("user should be able to get a rebate by locking LRC", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 35e17,
            amountB: 22e17,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      // Give the owner of the first order a burn rate rebate of 50%
      await exchangeTestUtil.lockLRC(ringsInfo.orders[0].owner, 0.5);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    });

  });

});
